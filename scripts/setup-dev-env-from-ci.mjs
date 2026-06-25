#!/usr/bin/env node
/**
 * Lädt .env.development aus dem letzten erfolgreichen provision-dev-supabase CI-Run.
 * Usage: pnpm setup:dev:env
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = resolve(ROOT, ".env.development");
const DL_DIR = resolve(ROOT, ".tmp/dev-env-artifact");

function gh(...args) {
  return execFileSync("gh", args, { encoding: "utf8", cwd: ROOT }).trim();
}

const runId = gh(
  "run",
  "list",
  "--workflow=provision-dev-supabase.yml",
  "--status=success",
  "--limit=1",
  "--json=databaseId",
  "-q",
  ".[0].databaseId",
);

if (!runId) {
  console.error("Kein erfolgreicher provision-dev-supabase Run gefunden.");
  console.error("Zuerst:  pnpm provision:dev");
  process.exit(1);
}

rmSync(DL_DIR, { recursive: true, force: true });
mkdirSync(DL_DIR, { recursive: true });

gh("run", "download", runId, "-n", "dev-env", "-D", DL_DIR);

const src = resolve(DL_DIR, "gwada-dev-env.development");
if (!existsSync(src)) {
  console.error(`Artifact fehlt (${src}).`);
  process.exit(1);
}

copyFileSync(src, TARGET);
console.log(`✓ ${TARGET} aus CI-Run ${runId} geschrieben.`);
console.log("Als Nächstes:");
console.log("  Terminal 1: pnpm db:tunnel:dev");
console.log("  Terminal 2: pnpm dev");
