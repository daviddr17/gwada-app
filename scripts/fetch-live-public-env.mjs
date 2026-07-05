#!/usr/bin/env node
/**
 * Liest öffentliche Live-Env aus data-gwada-public-env am HTML-Root (wie der Browser).
 * Nur publishable Keys — kein Service-Role.
 */
export async function fetchLivePublicEnv(
  origin = process.env.GWADA_LIVE_ORIGIN ?? "https://gwada.app",
) {
  const base = origin.replace(/\/+$/, "");
  const res = await fetch(`${base}/login`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Live login page ${res.status} (${base}/login)`);
  }
  const html = await res.text();
  const match = html.match(/data-gwada-public-env="([^"]+)"/);
  if (!match?.[1]) {
    throw new Error("data-gwada-public-env fehlt auf Live-Login-Seite");
  }
  const decoded = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'");
  const parsed = JSON.parse(decoded);
  return {
    siteUrl: parsed.siteUrl?.trim()?.replace(/\/+$/, "") ?? base,
    supabaseUrl: parsed.supabaseUrl?.trim()?.replace(/\/+$/, "") ?? `${base}/sb`,
    supabaseAnonKey: parsed.supabaseAnonKey?.trim() ?? "",
    supabaseProxy: Boolean(parsed.supabaseProxy),
  };
}

if (process.argv[1]?.endsWith("fetch-live-public-env.mjs")) {
  const env = await fetchLivePublicEnv();
  console.log(JSON.stringify(env, null, 2));
}
