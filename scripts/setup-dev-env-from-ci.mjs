#!/usr/bin/env node
/**
 * Lädt .env.development aus dem letzten erfolgreichen Dev-CI-Run.
 * Fehlert leise, wenn offline — behält bestehende Datei.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = resolve(ROOT, ".env.development");
const DL_DIR = resolve(ROOT, ".tmp/dev-env-artifact");

function gh(...args) {
  return execFileSync("gh", args, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function latestSuccessRun(workflow) {
  try {
    return gh(
      "run",
      "list",
      `--workflow=${workflow}`,
      "--status=success",
      "--limit=1",
      "--json=databaseId",
      "-q",
      ".[0].databaseId",
    );
  } catch {
    return "";
  }
}

const runId =
  latestSuccessRun("rotate-dev-secrets.yml") ||
  latestSuccessRun("seed-dev-db.yml") ||
  latestSuccessRun("provision-dev-supabase.yml");

if (!runId) {
  if (existsSync(TARGET)) {
    process.exit(0);
  }
  console.error("Kein Dev-CI-Run und keine .env.development — gh workflow run seed-dev-db.yml");
  process.exit(1);
}

try {
  rmSync(DL_DIR, { recursive: true, force: true });
  mkdirSync(DL_DIR, { recursive: true });
  gh("run", "download", runId, "-n", "dev-env", "-D", DL_DIR);
} catch (err) {
  if (existsSync(TARGET)) {
    process.exit(0);
  }
  throw err;
}

const src = resolve(DL_DIR, "gwada-dev-env.development");
if (!existsSync(src)) {
  if (existsSync(TARGET)) process.exit(0);
  console.error(`Artifact fehlt (${src}).`);
  process.exit(1);
}

copyFileSync(src, TARGET);
