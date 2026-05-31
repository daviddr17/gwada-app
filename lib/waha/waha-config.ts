import "server-only";

import { fetchPlatformWhatsappWahaConfigAdmin } from "@/lib/supabase/platform-whatsapp-secrets-db";

export type WahaServerConfig = {
  baseUrl: string;
  apiKey: string;
};

export function hasWahaEnvFallback(): boolean {
  return getWahaServerConfigFromEnv() != null;
}

function getWahaServerConfigFromEnv(): WahaServerConfig | null {
  const baseUrl = process.env.WAHA_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.WAHA_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

/**
 * WAHA-Zugangsdaten — zuerst Plattform-DB (Superadmin), sonst .env-Fallback.
 * Nur serverseitig; Key wird niemals an Restaurant-Clients zurückgegeben.
 */
export async function getWahaServerConfigAdmin(): Promise<WahaServerConfig | null> {
  const platform = await fetchPlatformWhatsappWahaConfigAdmin();
  if (platform.waha) return platform.waha;
  return getWahaServerConfigFromEnv();
}

export async function isWahaConfiguredAdmin(): Promise<boolean> {
  return (await getWahaServerConfigAdmin()) != null;
}

/** @deprecated Sync-Env-only — nutze getWahaServerConfigAdmin(). */
export function getWahaServerConfig(): WahaServerConfig | null {
  return getWahaServerConfigFromEnv();
}

/** @deprecated — nutze isWahaConfiguredAdmin(). */
export function isWahaConfigured(): boolean {
  return getWahaServerConfigFromEnv() != null;
}
