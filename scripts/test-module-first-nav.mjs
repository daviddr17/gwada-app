/**
 * Misst Soft-Nav Dashboard → Module nach Cold-Start.
 * Keep-alive Homes: Zeit bis Preview (Titel + Slot), nicht nur URL.
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
const SETTLE_AFTER_KPI_MS = Number(process.env.GWADA_NAV_SETTLE_MS || 2500);

const TARGETS = [
  {
    id: "menu",
    href: "/dashboard/menu/uebersicht",
    expect: /\/dashboard\/menu/,
    keepAlive: "menu",
    title: "Speisekarte",
  },
  {
    id: "inventory",
    href: "/dashboard/inventory/uebersicht",
    expect: /\/dashboard\/inventory/,
    keepAlive: "inventory",
    title: "Bestand",
  },
  {
    id: "reservierungen",
    href: "/dashboard/reservierungen/uebersicht",
    expect: /\/dashboard\/reservierungen/,
    keepAlive: "reservierungen",
    title: "Reservierungen",
  },
  {
    id: "mitarbeiter",
    href: "/dashboard/mitarbeiter/uebersicht",
    expect: /\/dashboard\/mitarbeiter/,
    keepAlive: "mitarbeiter",
    title: "Mitarbeiter",
  },
  {
    id: "kontakte",
    href: "/dashboard/kontakte/nachrichten?platform=all",
    expect: /\/dashboard\/kontakte/,
    keepAlive: "nachrichten",
    title: "Nachrichten",
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

async function waitForFirstKpi(page) {
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? "";
        return /\b\d+\b/.test(t) && t.includes("Heute");
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

  let previewMs = null;
  if (target.keepAlive) {
    await page.waitForFunction(
      ({ keepAlive, title }) => {
        const slot = document.querySelector(
          `[data-module-home-keep-alive="${keepAlive}"]:not(.hidden)`,
        );
        const chrome = document.body?.innerText?.includes(title);
        return Boolean(slot && chrome);
      },
      { keepAlive: target.keepAlive, title: target.title },
      { timeout: 15_000 },
    );
    previewMs = Date.now() - t0;
  }

  await page.waitForURL(target.expect, { timeout: 30_000 });
  const urlMs = Date.now() - t0;

  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('[aria-busy][aria-live="polite"]').length ===
        0,
      { timeout: 12_000 },
    )
    .catch(() => {});

  return { previewMs, urlMs, totalMs: Date.now() - t0 };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60_000);

console.log(`Base ${BASE}`);
await login(page);
await waitForFirstKpi(page);
await page.waitForTimeout(SETTLE_AFTER_KPI_MS);

const results = [];
for (const target of TARGETS) {
  if (!/\/dashboard\/?$/.test(new URL(page.url()).pathname)) {
    await page.evaluate(() => {
      const el = document.querySelector('a[href="/dashboard"]');
      if (el instanceof HTMLAnchorElement) el.click();
    });
    await page
      .waitForURL((url) => /\/dashboard\/?$/.test(url.pathname), {
        timeout: 25_000,
      })
      .catch(() => {});
    await page.waitForTimeout(500);
  }
  const ms = await softNavTo(page, target);
  results.push({ id: target.id, ...ms });
  console.log(
    `${target.id}: preview=${ms.previewMs ?? "-"}ms url=${ms.urlMs}ms total=${ms.totalMs}ms`,
  );
}

console.log(JSON.stringify({ settleMs: SETTLE_AFTER_KPI_MS, results }, null, 2));
await browser.close();
