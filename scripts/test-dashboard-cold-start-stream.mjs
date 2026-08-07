/**
 * Misst Dashboard-Summary Cold-Start: Zeit bis erstes Widget vs. Stream-Ende.
 * Login via Magic-Link (wie E2E), dann API stream=1.
 *
 * Usage: dotenv -e .env.development -- node scripts/test-dashboard-cold-start-stream.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import nextEnv from "@next/env";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { loadEnvConfig } = nextEnv;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(ROOT);

const BASE = (process.env.GWADA_E2E_BASE || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);
const EMAIL = process.env.GWADA_E2E_EMAIL || "dreyer@techlion.de";
const restaurantHint = process.env.GWADA_TEST_RESTAURANT_ID || "";

async function loginViaMagicLink(page) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE env fehlt");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
    options: { redirectTo: `${BASE}/auth/callback` },
  });
  if (error) throw error;
  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) throw new Error("kein hashed_token");

  const cb = new URL(`${BASE}/auth/callback`);
  cb.searchParams.set("token_hash", tokenHash);
  cb.searchParams.set("type", "email");
  cb.searchParams.set("next", "/dashboard");
  await page.goto(cb.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

async function resolveRestaurantId(page) {
  if (restaurantHint) return restaurantHint;
  return page.evaluate(async () => {
    const fromLs =
      localStorage.getItem("gwada:workspace-restaurant-id:v1") ||
      sessionStorage.getItem("gwada:workspace-restaurant-id");
    if (fromLs) return fromLs;
    // wait briefly for client resolve
    for (let i = 0; i < 40; i += 1) {
      const id =
        localStorage.getItem("gwada:workspace-restaurant-id:v1") ||
        sessionStorage.getItem("gwada:workspace-restaurant-id");
      if (id) return id;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  });
}

async function measureStream(page, restaurantId) {
  return page.evaluate(async ({ restaurantId, base }) => {
    const widgets =
      "reservations,staff,messages,inventory,menu,reviews,contacts,integrations";
    const url = `${base}/api/dashboard/summary?restaurantId=${encodeURIComponent(restaurantId)}&widgets=${widgets}&stream=1`;
    const t0 = performance.now();
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/x-ndjson" },
      cache: "no-store",
    });
    const tHeaders = performance.now();
    if (!res.ok || !res.body) {
      return {
        ok: false,
        status: res.status,
        contentType: res.headers.get("content-type"),
        body: await res.text(),
      };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const paints = [];
    let doneAt = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }
        const at = performance.now() - t0;
        if (parsed.w) {
          paints.push({
            w: parsed.w,
            ms: Math.round(at),
            hasData: parsed.d != null,
            error: parsed.e ?? null,
          });
        }
        if (parsed.done) doneAt = Math.round(at);
      }
    }
    return {
      ok: true,
      contentType: res.headers.get("content-type"),
      headersMs: Math.round(tHeaders - t0),
      firstWidgetMs: paints[0]?.ms ?? null,
      firstWidget: paints[0]?.w ?? null,
      doneMs: doneAt ?? Math.round(performance.now() - t0),
      paints,
    };
  }, { restaurantId, base: BASE });
}

async function measureUiCold(page) {
  // Clear client caches to simulate colder KPI path (keep auth cookies)
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("gwada:dashboard-batch:")) localStorage.removeItem(key);
    }
  });

  const t0 = Date.now();
  await page.goto(`${BASE}/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  // Wait for any Heute metric pill / compact metric to show a digit
  const firstNumber = await page.waitForFunction(
    () => {
      const root = document.body;
      const text = root?.innerText ?? "";
      // Heute tile or any dashboard metric with a number after skeleton
      const hasDigit = /\b\d+\b/.test(text) && !/Laden|Skeleton/i.test(
        document.querySelector("[data-slot='skeleton']")?.textContent ?? "",
      );
      // Prefer concrete KPI containers
      const pills = [...document.querySelectorAll("button, a, span, p")].filter(
        (el) => {
          const t = (el.textContent || "").trim();
          return /^\d+$/.test(t) || /^\d+\s*·\s*\d+$/.test(t);
        },
      );
      return pills.length > 0 || hasDigit;
    },
    { timeout: 20_000 },
  ).then(() => Date.now() - t0).catch(() => null);

  return { firstVisibleNumberMs: firstNumber, totalNavMs: Date.now() - t0 };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log("login…");
  await loginViaMagicLink(page);
  console.log("logged in at", page.url());

  // Warm navigate once so restaurant id persists
  await page.goto(`${BASE}/dashboard`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  }).catch(() => {});
  await page.waitForTimeout(1500);

  const restaurantId = await resolveRestaurantId(page);
  if (!restaurantId) throw new Error("restaurantId nicht gefunden");
  console.log("restaurantId", restaurantId);

  console.log("\n=== Stream API (kein Batch-LS) ===");
  // clear batch cache
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("gwada:dashboard-batch:")) localStorage.removeItem(key);
    }
  });
  const stream = await measureStream(page, restaurantId);
  console.log(JSON.stringify(stream, null, 2));

  console.log("\n=== UI reload cold KPIs ===");
  const ui = await measureUiCold(page);
  console.log(JSON.stringify(ui, null, 2));

  const pass =
    stream.ok &&
    typeof stream.firstWidgetMs === "number" &&
    stream.firstWidgetMs < 3000 &&
    stream.paints.length >= 2 &&
    stream.firstWidgetMs < stream.doneMs;

  console.log(pass ? "\nPASS: progressive stream works" : "\nFAIL: stream/timing");
  process.exit(pass ? 0 : 1);
} catch (e) {
  console.error("ERROR", e);
  process.exit(1);
} finally {
  await browser.close();
}
