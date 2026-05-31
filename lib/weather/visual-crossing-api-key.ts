import "server-only";

import { fetchPlatformWeatherConfigAdmin } from "@/lib/supabase/platform-weather-secrets-db";

/**
 * Visual-Crossing-API-Key — nur Plattform-DB (Superadmin), niemals .env-Fallback.
 * Nur serverseitig; Key wird niemals an Clients zurückgegeben.
 */
export async function getVisualCrossingApiKeyAdmin(): Promise<string | null> {
  const platform = await fetchPlatformWeatherConfigAdmin();
  if (!platform.enabled || !platform.apiKey) return null;
  return platform.apiKey;
}
