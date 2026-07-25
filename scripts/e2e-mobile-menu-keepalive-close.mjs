#!/usr/bin/env node
/**
 * Mobil: Nach warmem Nachrichten/Reservierungen darf ein Menü-Tap
 * das Sheet schließen — und der Dock-Button darf es während der
 * Close-Animation nicht sofort wieder öffnen.
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
  await page.evaluate(() => {
    document.querySelector('button[aria-label="Menü öffnen"]')?.click();
  });
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

async function softNavFromMenu(page, href) {
  await openMenu(page);
  assert.equal(await menuOpen(page), true, "menu should be open");
  const path = href.split("?")[0];
  await page.evaluate(
    ({ href, path }) => {
      const el =
        document.querySelector(`a[href="${href}"]`) ||
        document.querySelector(`a[href="${path}"]`);
      el?.click();
    },
    { href, path },
  );
  await page.waitForFunction(
    (expectPath) => {
      const p = location.pathname.replace(/\/+$/, "") || "/";
      return p === expectPath || p.startsWith(expectPath);
    },
    path,
    { timeout: 15_000 },
  );
  // Menü muss nach Soft-Nav zu warmem Keep-alive zu sein
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-app-mobile-chrome-overlay][data-open="true"]',
      ),
    { timeout: 5_000 },
  );
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
    await page.evaluate(() => {
      document
        .querySelector('a[href="/dashboard/reservierungen/uebersicht"]')
        ?.click();
    });
    // Sofort Dock tippen (Close-Animation / warm Keep-alive Race)
    await page.waitForTimeout(30);
    await page.evaluate(() => {
      const btn =
        document.querySelector('button[aria-label="Menü öffnen"]') ||
        document.querySelector('button[aria-label="Menü schließen"]');
      btn?.click();
    });
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
  } finally {
    await browser.close();
  }

  console.log("OK E2E mobile menu keep-alive close");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
