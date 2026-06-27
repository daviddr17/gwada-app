import "server-only";

import { weatherConfigFromJson } from "@/lib/integrations/platform-weather-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Visual-Crossing-Key — nur Service-Role, nie an Clients. */
export async function fetchPlatformWeatherConfigAdmin(): Promise<{
  enabled: boolean;
  apiKey: string | null;
}> {
  const sb = createSupabaseAdminClient();
  if (!sb) return { enabled: false, apiKey: null };

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "weather")
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformWeatherConfigAdmin", error?.message);
    return { enabled: false, apiKey: null };
  }

  const cfg = weatherConfigFromJson(data.config);
  const apiKey = cfg.api_key?.trim() ?? "";

  return {
    enabled: Boolean(data.enabled),
    apiKey: apiKey || null,
  };
}

/** Superadmin: Integration aktiv und Visual-Crossing-Key hinterlegt. */
export async function isPlatformWeatherAvailableAdmin(): Promise<boolean> {
  const cfg = await fetchPlatformWeatherConfigAdmin();
  return cfg.enabled && Boolean(cfg.apiKey);
}
