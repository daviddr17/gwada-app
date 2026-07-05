#!/usr/bin/env node
/**
 * Schreibt apps/staff/.env.production aus Live-Public-Env (gwada.app).
 * Usage: node scripts/staff-write-production-env.mjs
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLivePublicEnv } from "./fetch-live-public-env.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = (process.env.GWADA_LIVE_ORIGIN ?? "https://gwada.app").replace(
  /\/+$/,
  "",
);

const live = await fetchLivePublicEnv(ORIGIN);
const content = `# Sync von ${ORIGIN} — ${new Date().toISOString().slice(0, 10)}
EXPO_PUBLIC_GWADA_API_URL=${live.siteUrl}
EXPO_PUBLIC_SUPABASE_URL=${live.supabaseUrl}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${live.supabaseAnonKey}
`;

writeFileSync(resolve(ROOT, "apps/staff/.env.production"), content);
console.log(`✓ apps/staff/.env.production (${live.siteUrl})`);
