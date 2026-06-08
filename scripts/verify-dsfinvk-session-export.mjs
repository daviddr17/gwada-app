#!/usr/bin/env node
/**
 * Lists closed register sessions (DSFinV-K export is runtime-only via Fiskaly API).
 * Usage: node scripts/verify-dsfinvk-session-export.mjs [restaurantId]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const path = resolve(process.cwd(), "apps/web/.env.local");
  if (!existsSync(path)) {
    console.error("apps/web/.env.local fehlt");
    process.exit(1);
  }
  const text = readFileSync(path, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local fehlt");
  process.exit(1);
}

const restaurantId = process.argv[2] ?? null;
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: sessions, error } = await sb
  .from("pos_register_sessions")
  .select(
    "id, restaurant_id, closed_at, z_nr, dsfinvk_business_date, cash_point_closing_id",
  )
  .not("closed_at", "is", null)
  .order("closed_at", { ascending: false })
  .limit(restaurantId ? 20 : 10);

if (error) {
  console.error("DB:", error.message);
  process.exit(1);
}

const filtered = restaurantId
  ? sessions.filter((s) => s.restaurant_id === restaurantId)
  : sessions;

if (filtered.length === 0) {
  console.log("Keine geschlossenen Kassensitzungen gefunden.");
  process.exit(0);
}

console.log(`\nGeschlossene Kassensitzungen (${filtered.length}):\n`);
for (const s of filtered) {
  console.log(
    `  Z${s.z_nr ?? "?"}  ${s.closed_at?.slice(0, 10)}  business_date=${s.dsfinvk_business_date ?? "(ableiten)"}  session=${s.id}`,
  );
}

console.log(
  "\nDSFinV-K: Runtime-Download über GET /api/pos/fiskaly/register/sessions/{id}/dsfinvk-download",
);
console.log("Staff: Kasse → „ZIP teilen“ (lädt von Fiskaly, speichert lokal auf dem Gerät).\n");
