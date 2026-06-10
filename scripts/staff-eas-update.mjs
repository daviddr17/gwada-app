#!/usr/bin/env node
/**
 * OTA-Update für Gwada Staff (expo-updates).
 * preview-lan: sync .env → EAS preview, dann Update auf Channel preview-lan.
 * production: Update auf Channel production (URLs aus EAS production).
 *
 * Usage:
 *   node scripts/staff-eas-update.mjs preview-lan
 *   STAFF_UPDATE_MESSAGE="Fix Login" node scripts/staff-eas-update.mjs production
 */
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAFF_DIR = resolve(ROOT, "apps/staff");

const profile = process.argv[2]?.trim();
if (profile !== "preview-lan" && profile !== "production") {
  console.error("Usage: node scripts/staff-eas-update.mjs <preview-lan|production>");
  process.exit(1);
}

const channel = profile;
const environment = profile === "production" ? "production" : "preview";
const message =
  process.env.STAFF_UPDATE_MESSAGE?.trim() || `Gwada Staff OTA (${profile})`;

if (profile === "preview-lan") {
  execSync("node scripts/staff-eas-env-preview-lan.mjs", {
    cwd: ROOT,
    stdio: "inherit",
  });
} else if (profile === "production") {
  execSync("node scripts/staff-eas-env-production.mjs", {
    cwd: ROOT,
    stdio: "inherit",
  });
}

const cmd = [
  "pnpm dlx eas-cli@latest update",
  `--channel ${channel}`,
  `--environment ${environment}`,
  `--message ${JSON.stringify(message)}`,
  "--non-interactive",
].join(" ");

console.log(`\n→ ${cmd}\n`);
execSync(cmd, { cwd: STAFF_DIR, stdio: "inherit" });

console.log(
  `\nOTA published. iPhones mit Build auf Channel „${channel}“ laden beim nächsten App-Start.`,
);
