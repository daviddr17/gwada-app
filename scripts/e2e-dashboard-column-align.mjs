#!/usr/bin/env node
/**
 * Desktop-Dashboard: erste Kachel links und rechts müssen oben bündig sein.
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await dismissDevOverlay(page);

    const stats = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-slot=card], [data-slot='card']")];
      const fallback = [...document.querySelectorAll(".shadow-card")];
      const nodes = (cards.length ? cards : fallback).filter(
        (el) => el instanceof HTMLElement && el.getBoundingClientRect().width > 200,
      );
      const rects = nodes.map((el) => {
        const r = el.getBoundingClientRect();
        const title =
          el.querySelector("h2, h3, [class*='CardTitle'], .font-semibold")
            ?.textContent?.trim()
            .slice(0, 40) ?? "";
        return { title, top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width) };
      });
      const mid = window.innerWidth / 2;
      const full = rects.filter((c) => c.width > window.innerWidth * 0.55);
      const split = rects.filter((c) => c.width <= window.innerWidth * 0.55);
      const leftCol = split.filter((c) => c.left < mid - 80);
      const rightCol = split.filter((c) => c.left >= mid - 80);
      const leftTop = leftCol.length ? Math.min(...leftCol.map((c) => c.top)) : null;
      const rightTop = rightCol.length ? Math.min(...rightCol.map((c) => c.top)) : null;
      return {
        full,
        leftCol,
        rightCol,
        leftTop,
        rightTop,
        delta: leftTop != null && rightTop != null ? rightTop - leftTop : null,
      };
    });

    console.log(stats);
    const shot = process.env.GWADA_E2E_SCREENSHOT;
    if (shot) {
      await page.screenshot({ path: shot, fullPage: false });
    }
    assert.ok(stats.delta != null, "could not find two columns");
    assert.ok(
      Math.abs(stats.delta) <= 2,
      `right column starts ${stats.delta}px lower than left`,
    );
    console.log("OK columns aligned");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
