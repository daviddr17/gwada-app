#!/usr/bin/env node
/**
 * Phase-5 Smoke-Tests nach Domain-Cutover (gwada.app Production).
 * Usage: node scripts/smoke-production-cutover.mjs
 */
import { fetchLivePublicEnv } from "./fetch-live-public-env.mjs";

const ORIGIN = (process.env.GWADA_LIVE_ORIGIN ?? "https://gwada.app").replace(
  /\/+$/,
  "",
);
const LEGACY_BUBBLE = (
  process.env.GWADA_LEGACY_BUBBLE_URL ?? "https://old.gwada.app"
).replace(/\/+$/, "");

let failed = 0;

function ok(label, detail = "") {
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  failed += 1;
}

async function check(name, fn) {
  try {
    await fn();
  } catch (err) {
    fail(name, String(err));
  }
}

async function main() {
  console.log(`=== Production Smoke (${ORIGIN}) ===\n`);

  await check("build-info", async () => {
    const res = await fetch(`${ORIGIN}/api/build-info`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    if (!body.sha) throw new Error("sha fehlt");
    ok("build-info", body.sha);
  });

  await check("login page + public env", async () => {
    const env = await fetchLivePublicEnv(ORIGIN);
    if (!env.siteUrl.includes("gwada.app")) throw new Error(`siteUrl=${env.siteUrl}`);
    if (!env.supabaseUrl.includes("/sb")) throw new Error(`supabaseUrl=${env.supabaseUrl}`);
    if (!env.supabaseAnonKey) throw new Error("anon key fehlt");
    ok("public env", `${env.siteUrl} → ${env.supabaseUrl}`);
  });

  await check("/sb auth health", async () => {
    const env = await fetchLivePublicEnv(ORIGIN);
    const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: env.supabaseAnonKey },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    ok("/sb auth health", String(res.status));
  });

  await check("Google OAuth in GoTrue", async () => {
    const env = await fetchLivePublicEnv(ORIGIN);
    const res = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabaseAnonKey },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const settings = await res.json();
    if (!settings.external?.google) {
      fail("Google OAuth", "external.google nicht aktiv — sync-gotrue-google ausführen");
      return;
    }
    ok("Google OAuth", "external.google aktiv");
  });

  await check("embed loader", async () => {
    const res = await fetch(`${ORIGIN}/embed/v1/gwada.js`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    if (!text.includes("gwada-widget")) throw new Error("unexpected body");
    ok("embed loader", `${ORIGIN}/embed/v1/gwada.js`);
  });

  await check("new → redirect", async () => {
    const res = await fetch("https://new.gwada.app/api/build-info", {
      redirect: "manual",
      cache: "no-store",
    });
    if (res.status !== 301 && res.status !== 308 && res.status !== 302) {
      throw new Error(`status ${res.status}, erwartet 301`);
    }
    const loc = res.headers.get("location") ?? "";
    if (!loc.includes("gwada.app")) throw new Error(`location=${loc}`);
    ok("new.gwada.app redirect", `${res.status} → ${loc}`);
  });

  await check("legacy Bubble (old.gwada.app)", async () => {
    const res = await fetch(`${LEGACY_BUBBLE}/`, {
      redirect: "manual",
      cache: "no-store",
    });
    const powered = res.headers.get("x-powered-by") ?? "";
    if (res.status >= 500) throw new Error(String(res.status));
    if (powered.toLowerCase().includes("express") || res.ok) {
      ok("old.gwada.app", `HTTP ${res.status}${powered ? ` (${powered})` : ""}`);
    } else {
      fail("old.gwada.app", `HTTP ${res.status} — DNS/Bubble prüfen`);
    }
  });

  console.log("");
  if (failed) {
    console.error(`${failed} Check(s) fehlgeschlagen.`);
    process.exit(1);
  }
  console.log("Alle Smoke-Checks bestanden.");
}

main();
