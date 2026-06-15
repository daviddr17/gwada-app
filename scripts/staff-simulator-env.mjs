#!/usr/bin/env node
/**
 * Schreibt apps/staff/.env für iOS-Simulator (127.0.0.1).
 * Erkennt den laufenden Web-Dev-Port (3000–3005) automatisch.
 *
 * Voraussetzung: pnpm db:start, pnpm env:sync:local, pnpm dev
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAFF_ENV = resolve(ROOT, "apps/staff/.env");
const WEB_ENV = resolve(ROOT, "apps/web/.env.local");

function parseDotEnv(raw) {
  const out = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function readPublishableKey() {
  if (existsSync(WEB_ENV)) {
    const web = parseDotEnv(readFileSync(WEB_ENV, "utf8"));
    const key =
      web.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? web.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (key) return key;
  }
  try {
    const statusRaw = execSync("npx supabase status -o env", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const status = parseDotEnv(statusRaw);
    return status.PUBLISHABLE_KEY ?? status.ANON_KEY ?? "";
  } catch {
    return "";
  }
}

async function probeWebPort(host, port) {
  const url = `http://${host}:${port}/`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function detectWebPort(host = "127.0.0.1") {
  const ports = [3000, 3001, 3002, 3003, 3004, 3005];
  for (const port of ports) {
    if (await probeWebPort(host, port)) {
      return port;
    }
  }
  return 3000;
}

async function main() {
  const publishable = readPublishableKey();
  if (!publishable) {
    console.error(
      "Fehler: Kein Supabase Anon-Key — zuerst `pnpm db:start` und `pnpm env:sync:local`.",
    );
    process.exit(1);
  }

  const webPort = await detectWebPort();
  const lines = [
    "# iOS-Simulator — auto via pnpm staff:env:simulator",
    "EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
    `EXPO_PUBLIC_SUPABASE_ANON_KEY=${publishable}`,
    `EXPO_PUBLIC_GWADA_API_URL=http://127.0.0.1:${webPort}`,
    "",
  ];
  writeFileSync(STAFF_ENV, lines.join("\n"));
  console.log(`→ ${STAFF_ENV}`);
  console.log(`  EXPO_PUBLIC_GWADA_API_URL=http://127.0.0.1:${webPort}`);

  execSync("node apps/staff/scripts/generate-staff-env.js", {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (webPort !== 3000) {
    console.log("");
    console.log(
      `Hinweis: Web-API läuft auf Port ${webPort} (nicht 3000). Metro neu laden: r`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
