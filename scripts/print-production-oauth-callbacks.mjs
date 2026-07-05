#!/usr/bin/env node
/**
 * OAuth-/Webhook-URLs für Production (gwada.app) — für Google Cloud / Meta Developer Console.
 * Usage: node scripts/print-production-oauth-callbacks.mjs
 */
const ORIGIN = (process.env.GWADA_LIVE_ORIGIN ?? "https://gwada.app").replace(
  /\/+$/,
  "",
);

const paths = [
  "/api/auth/google/callback",
  "/auth/callback",
  "/api/integrations/google-business/callback",
  "/api/integrations/facebook/callback",
  "/api/integrations/instagram/callback",
];

console.log(`Production-Origin: ${ORIGIN}\n`);
console.log("Google Cloud Console — autorisierte Redirect-URIs:");
for (const p of paths.filter((p) => p.includes("google") || p === "/auth/callback")) {
  console.log(`  ${ORIGIN}${p}`);
}
console.log("\nMeta (Facebook/Instagram) — Valid OAuth Redirect URIs:");
for (const p of paths.filter((p) => p.includes("facebook") || p.includes("instagram"))) {
  console.log(`  ${ORIGIN}${p}`);
}
console.log("\nWAHA Webhook:");
console.log(`  ${ORIGIN}/api/integrations/waha/webhook`);
console.log("\nChangelog-Sync (GitHub Secret CHANGELOG_SYNC_URL):");
console.log(`  ${ORIGIN}/api/superadmin/changelog/sync-from-git`);
