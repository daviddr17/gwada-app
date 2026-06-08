#!/usr/bin/env node
/**
 * Backfill DSFinV-K cash register for a provisioned restaurant (local).
 * Usage: node scripts/test-fiskaly-dsfinvk-register.mjs [restaurantId]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve("apps/web/.env.local");
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("Missing apps/web/.env.local");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const restaurantId =
  process.argv[2]?.trim() || "4725e630-ebd1-4679-835e-fd8982fd5960";

const [platformRows, fiscalRows] = await Promise.all([
  fetch(
    `${url}/rest/v1/platform_integrations?key=eq.fiskaly&select=enabled,config`,
    { headers },
  ).then((r) => r.json()),
  fetch(
    `${url}/rest/v1/pos_restaurant_fiscal_config?restaurant_id=eq.${restaurantId}&select=fiskaly_tss_id,fiskaly_client_id,dsfinvk_cash_register_ready,fiskaly_provision_status`,
    { headers },
  ).then((r) => r.json()),
]);

const platform = platformRows[0];
const fiscal = fiscalRows[0];
if (!platform?.enabled) {
  console.error("Fiskaly not enabled");
  process.exit(1);
}
if (!fiscal?.fiskaly_tss_id || !fiscal?.fiskaly_client_id) {
  console.error("Restaurant not provisioned (TSS/client missing)");
  process.exit(1);
}

const cfg = platform.config ?? {};
const apiKey = cfg.api_key?.trim();
const apiSecret = cfg.api_secret?.trim();
const dsfinvkBase = (
  cfg.dsfinvk_base_url ?? "https://dsfinvk.fiskaly.com/api/v1"
).replace(/\/$/, "");

if (!apiKey || !apiSecret) {
  console.error("api_key or api_secret missing");
  process.exit(1);
}

if (fiscal.dsfinvk_cash_register_ready) {
  console.log("DSFinV-K cash register already ready for", restaurantId);
  process.exit(0);
}

const authRes = await fetch(`${dsfinvkBase}/auth`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
});
const authBody = await authRes.json().catch(() => ({}));
if (!authRes.ok) {
  console.error("DSFinV-K auth failed", authRes.status, authBody);
  process.exit(1);
}

const token = authBody.access_token;
const registerRes = await fetch(
  `${dsfinvkBase}/cash_registers/${fiscal.fiskaly_client_id}`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cash_register_type: {
        type: "MASTER",
        tss_id: fiscal.fiskaly_tss_id,
      },
      brand: "Gwada",
      model: "Staff POS",
      software: { brand: "Gwada", version: "1.0" },
      base_currency_code: "EUR",
    }),
  },
);
const registerBody = await registerRes.text();
console.log(`DSFinV-K cash register: HTTP ${registerRes.status}`);
console.log(registerBody);

if (!registerRes.ok) {
  process.exit(1);
}

const patchRes = await fetch(
  `${url}/rest/v1/pos_restaurant_fiscal_config?restaurant_id=eq.${restaurantId}`,
  {
    method: "PATCH",
    headers,
    body: JSON.stringify({ dsfinvk_cash_register_ready: true }),
  },
);
console.log(`DB update: HTTP ${patchRes.status}`);
process.exit(patchRes.ok ? 0 : 1);
