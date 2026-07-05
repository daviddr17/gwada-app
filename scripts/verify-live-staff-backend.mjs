#!/usr/bin/env node
/**
 * Smoke-Checks für Kellner-App gegen Live (Contabo / gwada.app).
 * Usage: pnpm staff:verify:live
 *
 * Optional: GWADA_TEST_EMAIL, GWADA_TEST_PASSWORD, GWADA_TEST_RESTAURANT_ID
 */
import { createClient } from "@supabase/supabase-js";
import { fetchLivePublicEnv } from "./fetch-live-public-env.mjs";

const LIVE_ORIGIN = "https://gwada.app";
const email = process.env.GWADA_TEST_EMAIL ?? "fadih32@gmail.com";
const password = process.env.GWADA_TEST_PASSWORD ?? "GwadaLiveProvision2026!";
const restaurantId =
  process.env.GWADA_TEST_RESTAURANT_ID ??
  "fad22222-2222-4222-8222-222222222201";

let failed = 0;

function ok(label, detail = "") {
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  failed += 1;
}

async function main() {
  console.log("=== Live Staff Backend Check ===\n");

  let buildSha = "?";
  try {
    const buildRes = await fetch(`${LIVE_ORIGIN}/api/build-info`, {
      cache: "no-store",
    });
    if (buildRes.ok) {
      const body = await buildRes.json();
      buildSha = body.sha ?? "?";
      ok("Web deploy", `build-info sha=${buildSha}`);
    } else {
      fail("Web deploy", `build-info ${buildRes.status}`);
    }
  } catch (err) {
    fail("Web deploy", String(err));
  }

  let env;
  try {
    env = await fetchLivePublicEnv(LIVE_ORIGIN);
    if (env.supabaseUrl?.includes("/sb") && env.supabaseAnonKey) {
      ok("Supabase proxy config", env.supabaseUrl);
    } else {
      fail("Supabase proxy config", "URL oder Anon-Key fehlt");
    }
  } catch (err) {
    fail("Supabase proxy config", String(err));
    process.exit(1);
  }

  try {
    const healthRes = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: env.supabaseAnonKey },
      cache: "no-store",
    });
    if (healthRes.ok) ok("/sb auth health", String(healthRes.status));
    else fail("/sb auth health", String(healthRes.status));
  } catch (err) {
    fail("/sb auth health", String(err));
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
  const { data: signIn, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signIn.session?.access_token) {
    fail(
      "Staff login",
      signInError?.message ??
        "keine Session — ggf. pnpm provision:live:fadi ausführen",
    );
  } else {
    ok("Staff login", email);
  }

  const token = signIn?.session?.access_token;
  if (token) {
    const { data: employees, error: empError } = await supabase
      .from("restaurant_employees")
      .select("restaurant_id, is_active, restaurants(name, slug)")
      .eq("profile_id", signIn.user.id)
      .eq("is_active", true);

    if (empError) {
      fail("restaurant_employees", empError.message);
    } else if (!employees?.length) {
      fail(
        "restaurant_employees",
        "keine aktiven Zuordnungen — provision:live:fadi",
      );
    } else {
      ok(
        "restaurant_employees",
        `${employees.length} Restaurant(s): ${employees
          .map((e) => e.restaurants?.slug ?? e.restaurant_id)
          .join(", ")}`,
      );
    }

    const posRes = await fetch(
      `${env.siteUrl}/api/pos/orders/active?restaurantId=${restaurantId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (posRes.ok) {
      ok("POS /orders/active", String(posRes.status));
    } else {
      const body = (await posRes.text()).slice(0, 120);
      fail("POS /orders/active", `${posRes.status} ${body}`);
    }
  }

  console.log("");
  if (failed) {
    console.error(`${failed} Check(s) fehlgeschlagen.`);
    process.exit(1);
  }
  console.log("Alle Checks bestanden — Live-Backend bereit für Staff production-Build.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
