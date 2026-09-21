#!/usr/bin/env node
/**
 * Laptop-Viewport: Nachrichten-Split darf den App-Scroll-Root nicht überragen.
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = (process.env.GWADA_E2E_BASE || "http://127.0.0.1:3000").replace(
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
  if (!url || !serviceKey) {
    throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
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

async function measure(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-app-scroll-root]");
    if (!(root instanceof HTMLElement)) {
      return { error: "missing scroll root" };
    }
    const slot = document.querySelector(
      '[data-module-home-keep-alive="nachrichten"]',
    );
    const innerScroll = Array.from(
      (slot ?? root).querySelectorAll("*"),
    ).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      const s = getComputedStyle(el);
      return s.overflowY === "auto" || s.overflowY === "scroll";
    }).length;
    return {
      clientHeight: root.clientHeight,
      scrollHeight: root.scrollHeight,
      scrollTopMax: root.scrollHeight - root.clientHeight,
      overflowY: getComputedStyle(root).overflowY,
      slotHeight: slot instanceof HTMLElement ? slot.getBoundingClientRect().height : null,
      innerScrollers: innerScroll,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto(`${BASE}/dashboard/kontakte/nachrichten?platform=all`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-module-home-keep-alive="nachrichten"]', {
      timeout: 30_000,
    });
    await page.waitForTimeout(1200);
    await dismissDevOverlay(page);

    const stats = await measure(page);
    console.log("laptop 1280x800", stats);
    if (stats.error) throw new Error(stats.error);

    assert.ok(
      stats.scrollTopMax <= 2,
      `scroll-root extra scroll ${stats.scrollTopMax}px (client=${stats.clientHeight} scroll=${stats.scrollHeight})`,
    );

    // 1366x768 — klassische Laptop-Höhe
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(500);
    const laptop = await measure(page);
    console.log("laptop 1366x768", laptop);
    assert.ok(
      laptop.scrollTopMax <= 2,
      `1366x768 extra scroll ${laptop.scrollTopMax}px (client=${laptop.clientHeight} scroll=${laptop.scrollHeight})`,
    );

    await page.goto(`${BASE}/dashboard/menu/uebersicht`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(800);
    const menu = await measure(page);
    console.log("menu 1366x768", menu);
    assert.ok(
      menu.scrollTopMax > 20,
      `menu should still page-scroll, got ${menu.scrollTopMax}px`,
    );

    console.log("OK nachrichten laptop no page-scroll under split");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
