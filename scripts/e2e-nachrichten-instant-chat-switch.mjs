#!/usr/bin/env node
/**
 * Desktop-Split: zweiter Chat-Klick muss Header/Pane sofort umschalten,
 * nicht erst wenn ?contact= in der URL ankommt.
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

function threadNameFromOpenLabel(label) {
  return (label || "")
    .replace(/^Chat mit /, "")
    .replace(/ öffnen,.*$/, "")
    .replace(/ öffnen$/, "");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const region = page.locator('[role="region"][aria-label^="Chat mit "]');

  try {
    await login(page);
    await page.goto(`${BASE}/dashboard/kontakte/nachrichten?platform=all`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-module-home-keep-alive="nachrichten"]', {
      timeout: 30_000,
    });
    await dismissDevOverlay(page);

    const listButtons = page.locator(
      'button[aria-label^="Chat mit "][aria-label$=" öffnen"], button[aria-label^="Chat mit "][aria-label*=" öffnen,"]',
    );
    await listButtons.first().waitFor({ timeout: 30_000 });
    const count = await listButtons.count();
    assert.ok(count >= 2, `need at least 2 chats, got ${count}`);

    const firstName = threadNameFromOpenLabel(
      await listButtons.nth(0).getAttribute("aria-label"),
    );
    const secondName = threadNameFromOpenLabel(
      await listButtons.nth(1).getAttribute("aria-label"),
    );
    console.log("chats", { firstName, secondName, count });

    await listButtons.nth(0).click();
    await region.filter({ hasText: firstName }).first().waitFor({
      timeout: 20_000,
    });
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('[role="region"][aria-label^="Chat mit "]')]
          .some((el) => el.getAttribute("aria-label") === `Chat mit ${name}`),
      firstName,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(1200);
    console.log("after first open", {
      url: new URL(page.url()).search,
      regions: await page.locator('[role="region"][aria-label^="Chat mit "]').evaluateAll(
        (els) => els.map((el) => el.getAttribute("aria-label")),
      ),
    });

    await listButtons.nth(1).hover();
    await page.waitForTimeout(400);

    const t0 = Date.now();
    await listButtons.nth(1).click();
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('[role="region"][aria-label^="Chat mit "]')]
          .some((el) => el.getAttribute("aria-label") === `Chat mit ${name}`),
      secondName,
      { timeout: 500 },
    );
    const headerMs = Date.now() - t0;
    const urlWhenHeader = new URL(page.url()).search;
    const paneState = await page.evaluate((name) => {
      const region = [...document.querySelectorAll('[role="region"][aria-label^="Chat mit "]')]
        .find((el) => el.getAttribute("aria-label") === `Chat mit ${name}`);
      const text = region?.textContent ?? "";
      return {
        empty: text.includes("Noch keine Nachrichten in diesem Verlauf."),
        skeleton: Boolean(region?.querySelector('[aria-busy="true"]')),
        url: location.search,
      };
    }, secondName);
    console.log("switch", { headerMs, urlWhenHeader, paneState });

    assert.ok(
      headerMs < 250,
      `header switch took ${headerMs}ms after Playwright click (want < 250ms including click overhead)`,
    );

    // URL darf hinterherhinken — Header muss trotzdem schon Chat 2 zeigen.
    const urlContact = new URL(page.url()).searchParams.get("contact");
    console.log("url contact at header switch", urlContact);

    await page.waitForTimeout(80);
    const regions = await page
      .locator('[role="region"][aria-label^="Chat mit "]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    assert.ok(
      regions.includes(`Chat mit ${secondName}`),
      `visible region should be second chat, got ${JSON.stringify(regions)}`,
    );

    const shot = process.env.GWADA_E2E_SCREENSHOT;
    if (shot) {
      await page.screenshot({ path: shot, fullPage: false });
      console.log("screenshot", shot);
    }

    console.log("OK instant chat switch", { headerMs, urlWhenHeader });
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
