import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { analyticsRangeBounds } from "@/lib/analytics/analytics-range";
import {
  productUsageTarget,
  websiteAnalyticsTarget,
} from "@/lib/analytics/classify-analytics-path";
import {
  buildPageViewInsert,
  countryCodeFromHeaders,
  externalReferrerHost,
  parseAnalyticsBrowser,
  parseAnalyticsDevice,
} from "@/lib/analytics/parse-analytics-request";

test("website paths keep the public site and drop the signed-in app", () => {
  assert.deepEqual(websiteAnalyticsTarget("/"), {
    path: "/",
    surface: "marketing",
  });
  assert.equal(websiteAnalyticsTarget("/docs/getting-started")?.surface, "docs");
  assert.equal(websiteAnalyticsTarget("/privacy")?.surface, "legal");
  assert.equal(websiteAnalyticsTarget("/zur-schlagd")?.surface, "public_site");
  assert.equal(
    websiteAnalyticsTarget("/invitation/super-secret-token-value-99")?.path,
    "/invitation",
  );
  assert.equal(websiteAnalyticsTarget("/dashboard/menu/overview"), null);
  assert.equal(websiteAnalyticsTarget("/superadmin/analytics"), null);
  assert.equal(websiteAnalyticsTarget("/favicon.ico"), null);
  assert.equal(websiteAnalyticsTarget("/docs?token=secret")?.path, "/docs");
});

test("product paths map modules and strip ids", () => {
  assert.equal(productUsageTarget("/dashboard")?.moduleId, "dashboard");
  assert.equal(
    productUsageTarget("/dashboard/menu/overview")?.moduleId,
    "menu",
  );
  assert.equal(
    productUsageTarget(
      "/dashboard/staff/11111111-1111-4111-8111-111111111111",
    )?.path,
    "/dashboard/staff/:id",
  );
  assert.equal(productUsageTarget("/dashboard/settings/team")?.moduleId, "einstellungen");
  assert.equal(productUsageTarget("/profile/personal")?.moduleId, "profil");
  assert.equal(productUsageTarget("/superadmin/users"), null);
});

test("client facts keep country and drop raw addresses", () => {
  const headers = new Headers({ "cf-ipcountry": "de" });
  assert.equal(countryCodeFromHeaders(headers), "DE");
  assert.equal(countryCodeFromHeaders(new Headers({ "cf-ipcountry": "XX" })), null);
  assert.equal(countryCodeFromHeaders(new Headers({ "x-real-ip": "203.0.113.8" })), null);

  assert.equal(
    externalReferrerHost("https://www.google.com/search?q=gwada", "gwada.app"),
    "www.google.com",
  );
  assert.equal(
    externalReferrerHost("https://gwada.app/docs?next=/dashboard", "gwada.app"),
    null,
  );

  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  assert.equal(parseAnalyticsDevice(iphone), "mobile");
  assert.equal(parseAnalyticsBrowser(iphone), "safari");
  assert.equal(
    parseAnalyticsBrowser(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ),
    "edge",
  );

  const row = buildPageViewInsert({
    path: "/",
    surface: "marketing",
    referrer_host: "google.com",
    device: "desktop",
    browser: "chrome",
    country_code: "DE",
    visitor_id: "11111111-1111-4111-8111-111111111111",
    session_id: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(Object.keys(row).sort(), [
    "browser",
    "country_code",
    "device",
    "path",
    "referrer_host",
    "session_id",
    "surface",
    "visitor_id",
  ]);
});

test("ranges use Europe/Berlin midnights", () => {
  const summer = new Date("2026-10-02T12:00:00.000Z");
  const today = analyticsRangeBounds("today", summer);
  assert.equal(today.from.toISOString(), "2026-10-01T22:00:00.000Z");
  assert.equal(today.to.toISOString(), summer.toISOString());

  const week = analyticsRangeBounds("7d", summer);
  assert.equal(week.from.toISOString(), "2026-09-25T22:00:00.000Z");

  const winter = new Date("2026-01-15T12:00:00.000Z");
  assert.equal(
    analyticsRangeBounds("today", winter).from.toISOString(),
    "2026-01-14T23:00:00.000Z",
  );
});

test("analytics migration stores country and not an IP", () => {
  const sql = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../supabase/migrations/20261002160000_platform_analytics.sql",
    ),
    "utf8",
  );
  assert.match(sql, /country_code/);
  assert.match(sql, /btrim\(v\.country_code::text\) = v_country/);
  assert.doesNotMatch(sql, /\b(ip_address|client_ip|remote_addr|user_agent)\b/i);
  assert.match(sql, /revoke all on table public\.platform_page_views from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.platform_website_analytics/);
});
