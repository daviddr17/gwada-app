#!/usr/bin/env node
/**
 * Local Fiskaly SIGN DE auth check (reads platform_integrations from local Supabase).
 * Usage: node scripts/test-fiskaly-provision.mjs
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
};

const rows = await fetch(
  `${url}/rest/v1/platform_integrations?key=eq.fiskaly&select=enabled,config`,
  { headers },
).then((r) => r.json());

const row = rows[0];
if (!row?.enabled) {
  console.error("Fiskaly not enabled");
  process.exit(1);
}

const cfg = row.config ?? {};
const apiKey = cfg.api_key?.trim();
const apiSecret = cfg.api_secret?.trim();
const signBase = (
  cfg.sign_de_base_url ?? "https://kassensichv-middleware.fiskaly.com/api/v2"
).replace(/\/$/, "");

if (!apiKey || !apiSecret) {
  console.error("api_key or api_secret missing");
  process.exit(1);
}

const authRes = await fetch(`${signBase}/auth`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
});
const authBody = await authRes.text();
console.log(`SIGN DE auth: HTTP ${authRes.status}`);
console.log(authBody);

process.exit(authRes.ok ? 0 : 1);
