#!/usr/bin/env node
/**
 * Schreibt SUPABASE_DB_URL in .env.production (Passwort aus Coolify: SERVICE_PASSWORD_POSTGRES).
 * Usage: npm run db:setup:live-url
 *    or: node scripts/set-supabase-db-url.mjs 'dein-passwort'
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = resolve(ROOT, ".env.production");

const HOST = process.env.LIVE_DB_HOST ?? "95.111.229.250";
const PORT = process.env.LIVE_DB_PORT ?? "5432";
const USER = process.env.LIVE_DB_USER ?? "postgres";
const DB = process.env.LIVE_DB_NAME ?? "postgres";

async function readPassword() {
  const arg = process.argv[2];
  if (arg) return arg;
  process.stdout.write(
    "SERVICE_PASSWORD_POSTGRES aus Coolify einfügen (Eingabe sichtbar, Enter): ",
  );
  return new Promise((resolvePrompt) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("", (answer) => {
      rl.close();
      resolvePrompt(answer.trim());
    });
  });
}

function withSslMode(url) {
  if (/[?&]sslmode=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=disable`;
}

function buildUrl(password) {
  const encoded = encodeURIComponent(password);
  return withSslMode(
    `postgresql://${USER}:${encoded}@${HOST}:${PORT}/${DB}`,
  );
}

function upsertEnvFile(url) {
  const line = `SUPABASE_DB_URL=${url}`;
  let content = "";
  try {
    content = readFileSync(ENV_FILE, "utf8");
  } catch {
    content = "";
  }

  const keyRe = /^SUPABASE_DB_URL=.*$/m;
  if (keyRe.test(content)) {
    content = content.replace(keyRe, line);
  } else {
    const marker =
      "# --- Postgres (CLI-Migrationen, von deinem Mac) ---\n";
    if (!content.includes(marker)) {
      content += `\n${marker}${line}\n`;
    } else {
      content += `${line}\n`;
    }
  }

  writeFileSync(ENV_FILE, content, "utf8");
}

const password = await readPassword();
if (!password) {
  console.error("Kein Passwort angegeben.");
  process.exit(1);
}

const url = buildUrl(password);
upsertEnvFile(url);

console.log("\n✓ .env.production aktualisiert:");
console.log(`  SUPABASE_DB_URL=postgresql://${USER}:****@${HOST}:${PORT}/${DB}`);
console.log("\nAls Nächstes:");
console.log("  npm run db:push:live -- --dry-run");
console.log(
  "\nBei „connection refused“: Postgres ist von außen nicht offen → docs/supabase-lokal-und-live.md (SSH-Tunnel).",
);
