/**
 * Misst Soft-Nav Dashboard → alle Sidebar-Module (Keep-alive Preview).
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
const SETTLE_AFTER_KPI_MS = Number(process.env.GWADA_NAV_SETTLE_MS || 3500);

const TARGETS = [
  { id: "menu", href: "/dashboard/menu/uebersicht", keepAlive: "menu", title: "Speisekarte" },
  { id: "inventory", href: "/dashboard/inventory/uebersicht", keepAlive: "inventory", title: "Bestand" },
  { id: "reservierungen", href: "/dashboard/reservierungen/uebersicht", keepAlive: "reservierungen", title: "Reservierungen" },
  { id: "pos", href: "/dashboard/pos/uebersicht", keepAlive: "pos", title: "POS" },
  { id: "events", href: "/dashboard/events/uebersicht", keepAlive: "events", title: "Events" },
  { id: "kontakte", href: "/dashboard/kontakte/nachrichten?platform=all", keepAlive: "nachrichten", title: "Nachrichten" },
  { id: "news", href: "/dashboard/news/uebersicht", keepAlive: "news", title: "News" },
  { id: "bewertungen", href: "/dashboard/bewertungen/uebersicht", keepAlive: "bewertungen", title: "Bewertungen" },
  { id: "insights", href: "/dashboard/insights/uebersicht", keepAlive: "insights", title: "Insights" },
  { id: "galerie", href: "/dashboard/galerie/uebersicht", keepAlive: "galerie", title: "Galerie" },
  { id: "buchfuehrung", href: "/dashboard/buchfuehrung/rechnungen", keepAlive: "buchfuehrung", title: "Buchführung" },
  { id: "dokumente", href: "/dashboard/dokumente/uebersicht", keepAlive: "dokumente", title: "Dokumente" },
  { id: "checklisten", href: "/dashboard/checklisten", keepAlive: "checklisten", title: "Checklisten" },
  { id: "mitarbeiter", href: "/dashboard/mitarbeiter/uebersicht", keepAlive: "mitarbeiter", title: "Mitarbeiter" },
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

  await page.waitForFunction(
    ({ keepAlive }) =>
      Boolean(
        document.querySelector(
          `[data-module-home-keep-alive="${keepAlive}"]:not(.hidden)`,
        ),
      ),
    { keepAlive: target.keepAlive },
    { timeout: 12_000 },
  );
  const previewMs = Date.now() - t0;

  const pathRe = new RegExp(
    target.href.split("?")[0].replace(/\//g, "\\/"),
  );
  await page.waitForURL(pathRe, { timeout: 35_000 }).catch(() => {});
  return { previewMs, urlMs: Date.now() - t0 };
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
    await page.waitForTimeout(400);
  }
  try {
    const ms = await softNavTo(page, target);
    results.push({ id: target.id, ...ms, ok: true });
    console.log(`${target.id}: preview=${ms.previewMs}ms url=${ms.urlMs}ms`);
  } catch (err) {
    results.push({ id: target.id, ok: false, error: String(err) });
    console.log(`${target.id}: FAIL`, err.message ?? err);
  }
}

const previews = results.filter((r) => r.ok).map((r) => r.previewMs);
console.log(
  JSON.stringify(
    {
      settleMs: SETTLE_AFTER_KPI_MS,
      previewMax: previews.length ? Math.max(...previews) : null,
      previewAvg: previews.length
        ? Math.round(previews.reduce((a, b) => a + b, 0) / previews.length)
        : null,
      results,
    },
    null,
    2,
  ),
);
await browser.close();
