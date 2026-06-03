#!/usr/bin/env node
/**
 * Liest google_oauth aus platform_integrations (JSON auf stdout, nur für Skripte).
 * Lädt .env.production und .env.local.
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
    "Fehlt NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY (.env.production)",
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
  console.error("google_oauth ist nicht aktiv.");
  process.exit(1);
}

const cfg = data.config ?? {};
const clientId =
  typeof cfg.client_id === "string" ? cfg.client_id.trim() : "";
const clientSecret =
  typeof cfg.client_secret === "string" ? cfg.client_secret.trim() : "";

if (!clientId || !clientSecret) {
  console.error("google_oauth: Client-ID oder Secret fehlt in der DB.");
  process.exit(1);
}

process.stdout.write(
  JSON.stringify({ clientId, clientSecret }),
);
