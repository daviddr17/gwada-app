import "server-only";

import { fetchPlatformWhatsappWahaConfigAdmin } from "@/lib/supabase/platform-whatsapp-secrets-db";

export type WahaServerConfig = {
  baseUrl: string;
  apiKey: string;
};

/**
 * WAHA-Zugangsdaten — nur Plattform-DB (Superadmin), niemals .env-Fallback.
 * Nur serverseitig; Key wird niemals an Restaurant-Clients zurückgegeben.
 */
export async function getWahaServerConfigAdmin(): Promise<WahaServerConfig | null> {
  const platform = await fetchPlatformWhatsappWahaConfigAdmin();
  if (!platform.waha) return null;
  return platform.waha;
}

export async function isWahaConfiguredAdmin(): Promise<boolean> {
  return (await getWahaServerConfigAdmin()) != null;
}
