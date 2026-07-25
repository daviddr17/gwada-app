#!/usr/bin/env node
/**
 * Mobil: Nach warmem Nachrichten/Reservierungen muss ein Menü-Tap
 * das Sheet schließen — ohne Click-Through auf Content darunter und
 * ohne Dock-Reopen während der Close-Animation.
 *
 * Nutzt echte Touch-Events (nicht el.click()), weil der Bug nur dort
 * reproduzierbar war (pointerdown→pendingHref vor synthetischem click).
 */
import { createClient } from "@supabase/supabase-js";
import { chromium, devices } from "playwright";
import assert from "node:assert/strict";

const BASE = (process.env.GWADA_E2E_BASE || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const EMAIL = process.env.GWADA_E2E_EMAIL || "dreyer@techlion.de";

async function dismissDevOverlay(page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  });
}

async function login(page) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  await page.goto(cb.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  await dismissDevOverlay(page);
}

async function openMenu(page) {
  await dismissDevOverlay(page);
  const openBtn = page.locator('button[aria-label="Menü öffnen"]');
  await openBtn.waitFor({ state: "visible", timeout: 10_000 });
  await openBtn.tap();
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector(
          '[data-app-mobile-chrome-overlay][data-open="true"]',
        ),
      ),
    { timeout: 10_000 },
  );
}

async function menuOpen(page) {
  return page.evaluate(() =>
    Boolean(
      document.querySelector(
        '[data-app-mobile-chrome-overlay][data-open="true"]',
      ),
    ),
  );
}

async function tapMenuLink(page, href) {
  const path = href.split("?")[0];
  const link = page.locator(`a[href="${href}"], a[href="${path}"]`).first();
  await link.waitFor({ state: "visible", timeout: 10_000 });
  await link.tap();
}

async function softNavFromMenu(page, href) {
  await openMenu(page);
  assert.equal(await menuOpen(page), true, "menu should be open");
  const path = href.split("?")[0];
  await tapMenuLink(page, href);
  await page.waitForFunction(
    (expectPath) => {
      const p = location.pathname.replace(/\/+$/, "") || "/";
      return p === expectPath || p.startsWith(expectPath);
    },
    path,
    { timeout: 15_000 },
  );
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-app-mobile-chrome-overlay][data-open="true"]',
      ),
    { timeout: 5_000 },
  );
  // Kurz warten: kein Click-Through darf ein fremdes Modul aktiv lassen
  await page.waitForTimeout(200);
  const stillOnTarget = await page.evaluate((expectPath) => {
    const p = location.pathname.replace(/\/+$/, "") || "/";
    return p === expectPath || p.startsWith(expectPath);
  }, path);
  assert.equal(stillOnTarget, true, `must stay on ${path} after menu close`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();

  try {
    await login(page);

    // Warm both keep-alive homes
    await page.goto(`${BASE}/dashboard/kontakte/nachrichten?platform=all`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/dashboard/reservierungen/uebersicht`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/dashboard/menu/uebersicht`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);

    await softNavFromMenu(
      page,
      "/dashboard/kontakte/nachrichten?platform=all",
    );
    console.log("OK menu closes → Nachrichten");

    // Dock during close animation must not reopen
    await page.goto(`${BASE}/dashboard/menu/uebersicht`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    await openMenu(page);
    await tapMenuLink(page, "/dashboard/reservierungen/uebersicht");
    await page.waitForTimeout(30);
    const dock = page.locator(
      'button[aria-label="Menü öffnen"], button[aria-label="Menü schließen"]',
    );
    await dock.tap();
    await page.waitForTimeout(400);
    assert.equal(
      await menuOpen(page),
      false,
      "dock tap during/after warm keep-alive nav must not leave menu open",
    );
    await page.waitForURL(/\/reservierungen/, { timeout: 15_000 });
    console.log("OK dock does not reopen during close → Reservierungen");

    await page.goto(`${BASE}/dashboard/menu/uebersicht`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    await softNavFromMenu(page, "/dashboard/reservierungen/uebersicht");
    console.log("OK menu closes → Reservierungen");

    await page.goto(`${BASE}/dashboard/menu/uebersicht`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    await softNavFromMenu(
      page,
      "/dashboard/kontakte/nachrichten?platform=all",
    );
    console.log("OK menu closes → Nachrichten (2)");

    // Warm ↔ warm: kein hängendes Menü, kein Modul-Flash-Stuck
    await openMenu(page);
    await tapMenuLink(page, "/dashboard/reservierungen/uebersicht");
    await page.waitForURL(/\/reservierungen/, { timeout: 15_000 });
    await page.waitForFunction(
      () =>
        !document.querySelector(
          '[data-app-mobile-chrome-overlay][data-open="true"]',
        ),
      { timeout: 5_000 },
    );
    console.log("OK warm Nachrichten → Reservierungen closes menu");
  } finally {
    await browser.close();
  }

  console.log("OK E2E mobile menu keep-alive close");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
