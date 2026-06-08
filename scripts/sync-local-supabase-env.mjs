#!/usr/bin/env node
/**
 * Schreibt Supabase-Keys aus `supabase status` nach Repo-Root `.env.local`
 * (für Next.js Web + POS-API Bearer-Auth).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ENV_FILE = resolve(ROOT, "apps/web/.env.local");
const ROOT_ENV_FILE = resolve(ROOT, ".env.local");

function parseStatusEnv(raw) {
  const out = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function readExistingEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1);
  }
  return out;
}

function writeEnvFile(path, entries) {
  const lines = [
    "# Auto-synced by scripts/sync-local-supabase-env.mjs — `pnpm env:sync:local`",
    "# Lokal nach `supabase start` / `pnpm db:start`",
    "",
  ];
  for (const [key, value] of Object.entries(entries)) {
    lines.push(`${key}=${value}`);
  }
  lines.push("");
  writeFileSync(path, lines.join("\n"));
}

function main() {
  let statusRaw = "";
  try {
    statusRaw = execSync("npx supabase status -o env", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    console.error(
      "Fehler: `supabase status` — läuft die lokale DB? (pnpm db:start)",
    );
    if (err instanceof Error && "stderr" in err) {
      const stderr = /** @type {{ stderr?: Buffer }} */ (err).stderr?.toString();
      if (stderr) console.error(stderr.trim());
    }
    process.exit(1);
  }

  const status = parseStatusEnv(statusRaw);
  const apiUrl = status.API_URL?.replace(/\/$/, "");
  const publishable = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  // SERVICE_ROLE_KEY = JWT für Admin-Client. SECRET_KEY (sb_secret_*) ist nicht dasselbe.
  const serviceRole = status.SERVICE_ROLE_KEY;

  if (!apiUrl || !publishable || !serviceRole) {
    console.error(
      "Fehler: Supabase-Status unvollständig (API_URL / PUBLISHABLE_KEY / SERVICE_ROLE_KEY).",
    );
    process.exit(1);
  }

  const existing = {
    ...readExistingEnv(WEB_ENV_FILE),
    ...readExistingEnv(ROOT_ENV_FILE),
  };
  const merged = {
    ...existing,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable,
    SUPABASE_SERVICE_ROLE_KEY: serviceRole,
    NEXT_PUBLIC_GWADA_WORKSPACE_SLUG:
      existing.NEXT_PUBLIC_GWADA_WORKSPACE_SLUG ?? "gwada-demo",
    NEXT_PUBLIC_GWADA_SUPABASE_ONLY:
      existing.NEXT_PUBLIC_GWADA_SUPABASE_ONLY ?? "false",
  };

  writeEnvFile(WEB_ENV_FILE, merged);
  writeEnvFile(ROOT_ENV_FILE, merged);

  console.log(`→ ${WEB_ENV_FILE} aktualisiert`);
  console.log(`→ ${ROOT_ENV_FILE} aktualisiert`);
  console.log(`  NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`);
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=(publishable)");
  console.log("  SUPABASE_SERVICE_ROLE_KEY=(service role)");
  console.log("");
  console.log("Web-Dev neu starten: pnpm dev");
}

main();
