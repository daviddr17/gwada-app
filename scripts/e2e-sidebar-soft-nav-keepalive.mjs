#!/usr/bin/env node
/**
 * Browser-E2E Soft-Nav nach warmem Nachrichten-Keep-alive.
 *
 * Desktop (default): Sidebar im DOM.
 * Mobil: GWADA_E2E_MOBILE=1 — iPhone-Viewport, Menü öffnen, dann AppNavLink.
 */
import { createClient } from "@supabase/supabase-js";
import { chromium, devices } from "playwright";

const BASE = (process.env.GWADA_E2E_BASE || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const EMAIL = process.env.GWADA_E2E_EMAIL || "dreyer@techlion.de";
const MOBILE =
  process.env.GWADA_E2E_MOBILE === "1" ||
  process.env.GWADA_E2E_MOBILE === "true";

const TARGETS = [
  { id: "dashboard", href: "/dashboard", expect: "/dashboard" },
  { id: "menu", href: "/dashboard/menu/uebersicht", expect: "/dashboard/menu" },
  {
    id: "inventory",
    href: "/dashboard/inventory/uebersicht",
    expect: "/dashboard/inventory",
  },
  {
    id: "reservierungen",
    href: "/dashboard/reservierungen/uebersicht",
    expect: "/dashboard/reservierungen",
  },
  { id: "pos", href: "/dashboard/pos/uebersicht", expect: "/dashboard/pos" },
  { id: "events", href: "/dashboard/events", expect: "/dashboard/events" },
  { id: "news", href: "/dashboard/news/uebersicht", expect: "/dashboard/news" },
  {
    id: "bewertungen",
    href: "/dashboard/bewertungen/uebersicht",
    expect: "/dashboard/bewertungen",
  },
  {
    id: "insights",
    href: "/dashboard/insights/uebersicht",
    expect: "/dashboard/insights",
  },
  {
    id: "galerie",
    href: "/dashboard/galerie/uebersicht",
    expect: "/dashboard/galerie",
  },
  {
    id: "buchfuehrung",
    href: "/dashboard/buchfuehrung/rechnungen",
    expect: "/dashboard/buchfuehrung",
  },
  {
    id: "dokumente",
    href: "/dashboard/dokumente/uebersicht",
    expect: "/dashboard/dokumente",
  },
  {
    id: "checklisten",
    href: "/dashboard/checklisten",
    expect: "/dashboard/checklisten",
  },
  {
    id: "mitarbeiter",
    href: "/dashboard/mitarbeiter/uebersicht",
    expect: "/dashboard/mitarbeiter",
  },
];

function pathOnly(url) {
  const u = new URL(url, BASE);
  let p = u.pathname;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

async function dismissDevOverlay(page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  });
}

async function login(page) {
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
  await page.goto(cb.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  await dismissDevOverlay(page);
}

async function warmNachrichten(page) {
  await page.goto(`${BASE}/dashboard/kontakte/nachrichten?platform=all`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForURL(/\/kontakte\/nachrichten/, { timeout: 30_000 });
  await dismissDevOverlay(page);
  await page.waitForTimeout(900);
}

async function openMobileMenu(page) {
  await dismissDevOverlay(page);
  const opened = await page.evaluate(() => {
    const closeBtn = document.querySelector(
      'button[aria-label="Menü schließen"]',
    );
    if (closeBtn) return true;
    const openBtn = document.querySelector('button[aria-label="Menü öffnen"]');
    if (!(openBtn instanceof HTMLButtonElement)) return false;
    openBtn.click();
    return true;
  });
  if (!opened) throw new Error("Menü öffnen nicht gefunden");

  await page.waitForFunction(() => {
    return Boolean(
      document.querySelector('a[href="/dashboard/menu/uebersicht"]') ||
        document.querySelector('button[aria-label="Menü schließen"]'),
    );
  }, { timeout: 12_000 });
  await page.waitForTimeout(250);
  await dismissDevOverlay(page);
}

async function softNavClick(page, mod) {
  if (MOBILE) {
    await openMobileMenu(page);
  } else {
    await dismissDevOverlay(page);
  }

  const hrefPath = mod.href.split("?")[0];
  const clicked = await page.evaluate(
    ({ href, hrefPath }) => {
      const el =
        document.querySelector(`a[href="${href}"]`) ||
        document.querySelector(`a[href="${hrefPath}"]`) ||
        document.querySelector(`a[href^="${hrefPath}?"]`);
      if (!(el instanceof HTMLAnchorElement)) return false;
      el.click();
      return true;
    },
    { href: mod.href, hrefPath },
  );
  if (!clicked) throw new Error(`AppNavLink nicht im DOM: ${mod.href}`);

  await page.waitForFunction(
    ({ expect, isDash }) => {
      const p = location.pathname.replace(/\/+$/, "") || "/";
      if (isDash) return p === "/dashboard";
      return p.startsWith(expect);
    },
    { expect: mod.expect, isDash: mod.id === "dashboard" },
    { timeout: 20_000 },
  );
}

async function assertStable(page, mod) {
  await page.waitForTimeout(1400);
  let p = pathOnly(page.url());
  if (p.includes("/kontakte/nachrichten")) {
    throw new Error(`hijacked → ${page.url()}`);
  }
  if (mod.id === "dashboard" ? p !== "/dashboard" : !p.startsWith(mod.expect)) {
    throw new Error(`unexpected path ${p}`);
  }
  await page.waitForTimeout(1600);
  p = pathOnly(page.url());
  if (p.includes("/kontakte/nachrichten")) {
    throw new Error(`delayed hijack → ${page.url()}`);
  }
  return p;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    MOBILE
      ? { ...devices["iPhone 13"] }
      : { viewport: { width: 1280, height: 800 } },
  );
  const page = await context.newPage();
  const failures = [];
  const mode = MOBILE ? "mobil" : "desktop";

  try {
    await login(page);
    console.log(`[${mode}] login`, pathOnly(page.url()));
    await warmNachrichten(page);
    console.log(`[${mode}] warm nachrichten`);

    for (const mod of TARGETS) {
      try {
        await warmNachrichten(page);
        await softNavClick(page, mod);
        const landed = await assertStable(page, mod);
        console.log(`[${mode}] OK`, mod.id, "→", landed);
      } catch (e) {
        failures.push(`${mod.id}: ${e.message}`);
        console.error(`[${mode}] FAIL`, mod.id, e.message);
      }
    }

    for (const mod of TARGETS) {
      try {
        await warmNachrichten(page);
        await softNavClick(page, mod);
        const landed = await assertStable(page, mod);
        console.log(`[${mode}] OK rapid`, mod.id, "→", landed);
      } catch (e) {
        failures.push(`rapid ${mod.id}: ${e.message}`);
        console.error(`[${mode}] FAIL rapid`, mod.id, e.message);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(`\n[${mode}] ${failures.length} Fehler`);
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log(
    `\nOK E2E Soft-Nav (${mode}): ${TARGETS.length} Module × 2 Durchläufe (warm Inbox)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
