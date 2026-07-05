#!/usr/bin/env node
/**
 * Liest google_oauth aus platform_integrations (Service Role) und gibt
 * die GoTrue-Env-Zeilen aus — Client-ID/Secret müssen mit Superadmin übereinstimmen.
 *
 * Voraussetzung: .env.local mit NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * (lokal typisch http://127.0.0.1:54321)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env.production");
loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error(
    "Fehlt NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin
  .from("platform_integrations")
  .select("enabled, config")
  .eq("key", "google_oauth")
  .maybeSingle();

if (error) {
  console.error(error.message);
  process.exit(1);
}

if (!data?.enabled) {
  console.log("google_oauth ist in der DB nicht aktiv.");
  process.exit(0);
}

const cfg = data.config ?? {};
const clientId = typeof cfg.client_id === "string" ? cfg.client_id.trim() : "";
const hasSecret = Boolean(
  typeof cfg.client_secret === "string" && cfg.client_secret.trim(),
);

if (!clientId || !hasSecret) {
  console.log("google_oauth: Client-ID oder Secret fehlt in platform_integrations.");
  process.exit(1);
}

console.log("# GoTrue / Supabase Auth — Werte müssen mit Superadmin übereinstimmen:\n");
console.log(`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=${clientId}`);
const secret =
  typeof cfg.client_secret === "string" ? cfg.client_secret.trim() : "";
if (secret) {
  console.log(`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=${secret}`);
  console.log(`GOTRUE_EXTERNAL_GOOGLE_SECRET=${secret}`);
} else {
  console.log("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<Secret fehlt in DB>");
}
console.log("GOTRUE_EXTERNAL_GOOGLE_ENABLED=true");
console.log(`GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=${clientId}`);
console.log("\n# Google Cloud Console — autorisierte Redirect-URI:");
const site =
  process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/+$/, "") ||
  "https://gwada.app";
console.log(`${site}/api/auth/google/callback`);
console.log("\n# Lokal zusätzlich in supabase/config.toml: [auth.external.google] enabled = true");
