#!/usr/bin/env node
/**
 * Schreibt Supabase-Variablen aus `.env.development` nach `.env.local` (behält WAHA etc.).
 * Usage: pnpm env:sync:dev
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEV = resolve(ROOT, ".env.development");
const LOCAL = resolve(ROOT, ".env.local");
const WEB_LOCAL = resolve(ROOT, "apps/web/.env.local");

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_PROXY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "NEXT_PUBLIC_GWADA_WORKSPACE_SLUG",
  "NEXT_PUBLIC_GWADA_SUPABASE_ONLY",
];

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    map.set(line.slice(0, i), line.slice(i + 1));
  }
  return map;
}

function mergeEnvFile(targetPath, devMap) {
  let existing = "";
  if (existsSync(targetPath)) {
    existing = readFileSync(targetPath, "utf8");
  }
  const local = parseEnv(existing);
  for (const k of KEYS) {
    if (devMap.has(k)) local.set(k, devMap.get(k));
  }
  const otherLines = existing
    .split("\n")
    .filter((line) => {
      if (!line || line.startsWith("#")) return true;
      const key = line.split("=")[0];
      return !KEYS.includes(key);
    })
    .filter((line, idx, arr) => !(line.startsWith("# Auto-synced") && idx < 3));

  const header = `# Auto-synced by scripts/sync-dev-env.mjs — Remote-Dev (pnpm env:sync:dev)\n`;
  const supabaseBlock = KEYS.filter((k) => local.has(k))
    .map((k) => `${k}=${local.get(k)}`)
    .join("\n");
  const rest = otherLines
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");

  writeFileSync(
    targetPath,
    `${header}\n${supabaseBlock}\n${rest ? `\n${rest}\n` : ""}`,
    "utf8",
  );
}

if (!existsSync(DEV)) {
  console.error(".env.development fehlt — zuerst: pnpm setup:dev:env");
  process.exit(1);
}

const devMap = parseEnv(readFileSync(DEV, "utf8"));
mergeEnvFile(LOCAL, devMap);
mergeEnvFile(WEB_LOCAL, devMap);
console.log("✓ .env.local + apps/web/.env.local → Remote-Dev Supabase");
console.log("  Neustart: pnpm dev");
