#!/usr/bin/env node
/**
 * Reads apps/staff/.env and writes src/lib/staff-env.generated.ts.
 * Used by staff-ios-simulator.sh (fast) and app.config.ts (Metro start).
 */
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const staffRoot = join(__dirname, "..");

function loadStaffDotEnv() {
  const envPath = join(staffRoot, ".env");
  if (!existsSync(envPath)) return {};

  const out = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function escapeTsString(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function resolveStaffEnv() {
  const dotenv = loadStaffDotEnv();

  return {
    supabaseUrl:
      dotenv.EXPO_PUBLIC_SUPABASE_URL ??
      process.env.EXPO_PUBLIC_SUPABASE_URL ??
      "http://127.0.0.1:54321",
    supabaseAnonKey:
      dotenv.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      "",
    gwadaApiUrl:
      dotenv.EXPO_PUBLIC_GWADA_API_URL ??
      process.env.EXPO_PUBLIC_GWADA_API_URL ??
      "http://127.0.0.1:3000",
  };
}

function writeStaffEnvModule(values) {
  const target = join(staffRoot, "src/lib/staff-env.generated.ts");
  writeFileSync(
    target,
    `// Auto-generated — do not edit manually.
export const staffEnv = {
  supabaseUrl: '${escapeTsString(values.supabaseUrl)}',
  supabaseAnonKey: '${escapeTsString(values.supabaseAnonKey)}',
  gwadaApiUrl: '${escapeTsString(values.gwadaApiUrl)}',
} as const;
`,
  );
  return target;
}

function generateStaffEnv() {
  const values = resolveStaffEnv();
  writeStaffEnvModule(values);
  return values;
}

if (require.main === module) {
  const values = generateStaffEnv();
  const keyOk = Boolean(values.supabaseAnonKey);
  console.log(
    `staff-env.generated.ts ok (supabase=${values.supabaseUrl}, key=${keyOk ? "set" : "MISSING"})`,
  );
  if (!keyOk) {
    process.exitCode = 1;
  }
}

module.exports = { generateStaffEnv, resolveStaffEnv, writeStaffEnvModule };
