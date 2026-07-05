#!/usr/bin/env node
/**
 * Schreibt EAS Environment `production` für Gwada Staff (Live / Contabo).
 * Quelle: .env.production (NEXT_PUBLIC_*) oder öffentliche Live-Env von gwada.app.
 *
 * Usage: pnpm staff:eas-env:production
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLivePublicEnv } from "./fetch-live-public-env.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROD_ENV = resolve(ROOT, ".env.production");
const STAFF_DIR = resolve(ROOT, "apps/staff");
const LIVE_ORIGIN = "https://gwada.app";

const EXPO_VARS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_GWADA_API_URL",
];

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
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

function resolveStaffProductionValues(fileEnv) {
  const siteUrl =
    fileEnv.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/+$/, "") || LIVE_ORIGIN;
  const supabaseUrl =
    fileEnv.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, "") ||
    `${siteUrl}/sb`;
  const anonKey = fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  return {
    EXPO_PUBLIC_GWADA_API_URL: siteUrl,
    EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  };
}

async function main() {
  if (!process.env.EXPO_TOKEN?.trim()) {
    const whoami = (() => {
      try {
        execSync("pnpm dlx eas-cli@latest whoami", {
          cwd: STAFF_DIR,
          stdio: "pipe",
          encoding: "utf8",
        });
        return true;
      } catch {
        return false;
      }
    })();
    if (!whoami) {
      console.error(
        "EAS nicht angemeldet. Einmalig:\n" +
          "  1. https://expo.dev/accounts/atfadi17/settings/access-tokens → Token erstellen\n" +
          "  2. gh secret set EXPO_TOKEN --body \"<token>\"\n" +
          "  3. gh workflow run sync-staff-eas-env-live.yml --ref main\n" +
          "Oder lokal: eas login && pnpm staff:eas-env:production",
      );
      process.exit(1);
    }
  }

  const fileEnv = loadEnvFile(PROD_ENV);
  let values = resolveStaffProductionValues(fileEnv);

  if (
    !values.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    !values.EXPO_PUBLIC_SUPABASE_URL.includes("gwada.app")
  ) {
    console.log(
      "→ Live-Public-Env von gwada.app (publishable Key, wie im Browser) …",
    );
    const live = await fetchLivePublicEnv(LIVE_ORIGIN);
    values = {
      EXPO_PUBLIC_GWADA_API_URL: live.siteUrl || LIVE_ORIGIN,
      EXPO_PUBLIC_SUPABASE_URL: live.supabaseUrl || `${LIVE_ORIGIN}/sb`,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: live.supabaseAnonKey,
    };
  }

  for (const key of EXPO_VARS) {
    const value = values[key];
    if (!value) {
      console.error(`Fehler: ${key} konnte nicht aufgelöst werden.`);
      console.error(
        "Trage NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.production ein",
      );
      process.exit(1);
    }
    if (value.startsWith("http://") && !value.includes("127.0.0.1")) {
      console.error(
        `Fehler: ${key} muss HTTPS sein für iOS production (${value}).`,
      );
      process.exit(1);
    }
  }

  if (!values.EXPO_PUBLIC_SUPABASE_URL.endsWith("/sb")) {
    console.warn(
      "Warnung: EXPO_PUBLIC_SUPABASE_URL sollte auf /sb enden (HTTPS-Proxy).",
    );
  }

  const environment = "production";
  for (const key of EXPO_VARS) {
    const value = values[key];
    const visibility =
      key === "EXPO_PUBLIC_GWADA_API_URL" ? "plaintext" : "sensitive";
    console.log(`→ eas env:create ${environment} --name ${key} --value … --force`);
    execSync(
      `pnpm dlx eas-cli@latest env:create ${environment} --name ${key} --value ${JSON.stringify(value)} --type string --visibility ${visibility} --force --non-interactive`,
      { cwd: STAFF_DIR, stdio: "inherit" },
    );
  }

  console.log("");
  console.log("EAS production-Environment aktualisiert für profile production.");
  console.log(`  EXPO_PUBLIC_GWADA_API_URL=${values.EXPO_PUBLIC_GWADA_API_URL}`);
  console.log(`  EXPO_PUBLIC_SUPABASE_URL=${values.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log("  EXPO_PUBLIC_SUPABASE_ANON_KEY=(publishable)");
  console.log("");
  console.log("Build: pnpm staff:build:ios:production");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
