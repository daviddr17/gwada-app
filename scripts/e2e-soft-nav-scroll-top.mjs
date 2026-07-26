#!/usr/bin/env node
/**
 * Soft-Nav: nach Modulwechsel startet der Scroll-Root oben
 * (nicht bei der Scroll-Position des vorherigen Moduls).
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
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

async function scrollRootTo(page, top) {
  await page.evaluate((y) => {
    const root = document.querySelector("[data-app-scroll-root]");
    if (root) root.scrollTop = y;
  }, top);
}

async function scrollRootTop(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-app-scroll-root]");
    return root ? root.scrollTop : -1;
  });
}

async function softNav(page, href) {
  const path = href.split("?")[0];
  await page.evaluate(
    ({ href, path }) => {
      const el =
        document.querySelector(`a[href="${href}"]`) ||
        document.querySelector(`a[href="${path}"]`);
      if (!el) throw new Error(`missing link ${href}`);
      el.click();
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
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  // Desktop: Sidebar-Links immer im DOM (kein Mobile-Menü nötig).
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await login(page);

    await page.goto(`${BASE}/dashboard/menu/uebersicht`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(800);
    await scrollRootTo(page, 420);
    assert.ok((await scrollRootTop(page)) >= 300, "menu should be scrolled");

    await softNav(page, "/dashboard/inventory/uebersicht");
    await page.waitForTimeout(200);
    assert.equal(
      await scrollRootTop(page),
      0,
      "inventory soft-nav must start at scroll top",
    );
    console.log("OK menu → inventory scroll top");

    await scrollRootTo(page, 380);
    await softNav(page, "/dashboard/mitarbeiter/uebersicht");
    await page.waitForTimeout(200);
    assert.equal(
      await scrollRootTop(page),
      0,
      "mitarbeiter soft-nav must start at scroll top",
    );
    console.log("OK inventory → mitarbeiter scroll top");
  } finally {
    await browser.close();
  }

  console.log("OK E2E soft-nav scroll top");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
