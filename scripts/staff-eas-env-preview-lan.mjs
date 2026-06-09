#!/usr/bin/env node
/**
 * Liest apps/staff/.env (nach staff-lan-env.mjs) und schreibt EAS-Env für preview-lan.
 * Voraussetzung: eas login, apps/staff/.env mit LAN-URLs.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAFF_ENV = resolve(ROOT, "apps/staff/.env");
const STAFF_DIR = resolve(ROOT, "apps/staff");

const VARS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_GWADA_API_URL",
];

function loadEnv(path) {
  if (!existsSync(path)) return null;
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function main() {
  const env = loadEnv(STAFF_ENV);
  if (!env) {
    console.error(`Fehler: ${STAFF_ENV} fehlt. Zuerst: pnpm staff:env:lan`);
    process.exit(1);
  }

  for (const key of VARS) {
    const value = env[key];
    if (!value) {
      console.error(`Fehler: ${key} fehlt in ${STAFF_ENV}`);
      process.exit(1);
    }
    if (value.includes("127.0.0.1") || value.includes("localhost")) {
      console.error(
        `Fehler: ${key} enthält localhost — für preview-lan LAN-IP nutzen (pnpm staff:env:lan).`,
      );
      process.exit(1);
    }
  }

  const environment = "preview";
  for (const key of VARS) {
    const value = env[key];
    console.log(`→ eas env:create ${environment} --name ${key} --value … --force`);
    execSync(
      `pnpm dlx eas-cli@latest env:create ${environment} --name ${key} --value ${JSON.stringify(value)} --type string --visibility plaintext --force --non-interactive`,
      { cwd: STAFF_DIR, stdio: "inherit" },
    );
  }

  console.log("");
  console.log("EAS preview-Environment aktualisiert für profile preview-lan.");
  console.log("Build: pnpm staff:build:ios:preview-lan");
}

main();
