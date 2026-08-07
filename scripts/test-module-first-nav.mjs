/**
 * Misst Soft-Nav Dashboard → Module nach Cold-Start (Daten-Caches geleert).
 * RSC/Compile einmal vorwärmen — sonst misst Dev die On-Demand-Compile, nicht Prod.
 *
 * Usage: pnpm exec dotenv -e .env.development -- node scripts/test-module-first-nav.mjs
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
/** Nach Dashboard-KPI warten, damit Modul-Warm laufen kann (wie echter Nutzer ~1s). */
const SETTLE_AFTER_KPI_MS = Number(process.env.GWADA_NAV_SETTLE_MS || 1500);

const TARGETS = [
  { id: "menu", href: "/dashboard/menu/uebersicht", expect: /\/dashboard\/menu/ },
  {
    id: "inventory",
    href: "/dashboard/inventory/uebersicht",
    expect: /\/dashboard\/inventory/,
  },
  {
    id: "reservierungen",
    href: "/dashboard/reservierungen/uebersicht",
    expect: /\/dashboard\/reservierungen/,
  },
  {
    id: "mitarbeiter",
    href: "/dashboard/mitarbeiter/uebersicht",
    expect: /\/dashboard\/mitarbeiter/,
  },
  {
    id: "kontakte",
    href: "/dashboard/kontakte/nachrichten?platform=all",
    expect: /\/dashboard\/kontakte/,
  },
  { id: "news", href: "/dashboard/news", expect: /\/dashboard\/news/ },
  {
    id: "bewertungen",
    href: "/dashboard/bewertungen",
    expect: /\/dashboard\/bewertungen/,
  },
];

async function login(page) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
    options: { redirectTo: `${BASE}/auth/callback` },
  });
  if (error) throw error;
  const cb = new URL(`${BASE}/auth/callback`);
  cb.searchParams.set("token_hash", data.properties.hashed_token);
  cb.searchParams.set("type", "email");
  cb.searchParams.set("next", "/dashboard");
  await page.goto(cb.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 });
}

async function clearModuleDataCaches(page) {
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (
        key.startsWith("gwada:") ||
        key.includes("menu") ||
        key.includes("staff") ||
        key.includes("reserv") ||
        key.includes("inbox") ||
        key.includes("inventory")
      ) {
        sessionStorage.removeItem(key);
      }
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("gwada:dashboard-batch:")) {
        localStorage.removeItem(key);
      }
    }
  });
}

async function waitForFirstKpi(page) {
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? "";
        return /\b\d+\b/.test(t) && (t.includes("Heute") || t.includes("KPI"));
      },
      { timeout: 25_000 },
    )
    .catch(() => {});
}

async function softNavTo(page, target) {
  const t0 = Date.now();
  const clicked = await page.evaluate((href) => {
    const path = href.split("?")[0];
    const el =
      document.querySelector(`a[href="${href}"]`) ||
      document.querySelector(`a[href^="${path}"]`);
    if (!(el instanceof HTMLAnchorElement)) return false;
    el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    el.click();
    return true;
  }, target.href);
  if (!clicked) throw new Error(`Link missing: ${target.href}`);

  await page.waitForURL(target.expect, { timeout: 25_000 });

  // SoftNav-Cover: absolute Overlay mit aria-busy — nicht jedes aria-busy im Screen.
  await page
    .waitForFunction(
      () => {
        const overlays = [
          ...document.querySelectorAll('[aria-busy][aria-live="polite"]'),
        ];
        return overlays.length === 0;
      },
      { timeout: 12_000 },
    )
    .catch(() => {});

  return Date.now() - t0;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60_000);

console.log(`Base ${BASE}`);
await login(page);
await waitForFirstKpi(page);

// Dev: Routen einmal kompilieren (Prod hat das schon).
console.log("Warming RSC/compile…");
for (const target of TARGETS) {
  await page.goto(`${BASE}${target.href}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(300);
}
await page.goto(`${BASE}/dashboard`, {
  waitUntil: "domcontentloaded",
  timeout: 90_000,
});
await clearModuleDataCaches(page);
await page.reload({ waitUntil: "domcontentloaded" });
await waitForFirstKpi(page);
await page.waitForTimeout(SETTLE_AFTER_KPI_MS);

const results = [];
for (const target of TARGETS) {
  // Zurück auf Dashboard für fairen First-Soft-Nav (Caches bleiben warm).
  if (!page.url().includes("/dashboard") || page.url().match(/\/dashboard\/.+/)) {
    await page.evaluate(() => {
      const el = document.querySelector('a[href="/dashboard"]');
      if (el instanceof HTMLAnchorElement) el.click();
    });
    await page.waitForURL(/\/dashboard\/?$/, { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const ms = await softNavTo(page, target);
  results.push({ id: target.id, ms });
  console.log(`${target.id}: ${ms}ms`);
}

console.log(JSON.stringify({ settleMs: SETTLE_AFTER_KPI_MS, results }, null, 2));
await browser.close();
