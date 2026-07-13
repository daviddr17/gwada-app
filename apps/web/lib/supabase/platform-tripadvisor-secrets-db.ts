import "server-only";

import { tripadvisorConfigFromJson } from "@/lib/integrations/platform-tripadvisor-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** TripAdvisor Terra API-Key — nur Service-Role, nie an Clients. */
export async function fetchPlatformTripadvisorConfigAdmin(): Promise<{
  enabled: boolean;
  apiKey: string | null;
}> {
  const sb = createSupabaseAdminClient();
  if (!sb) return { enabled: false, apiKey: null };

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "tripadvisor")
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformTripadvisorConfigAdmin", error?.message);
    return { enabled: false, apiKey: null };
  }

  const cfg = tripadvisorConfigFromJson(data.config);
  const apiKey = cfg.api_key?.trim() ?? "";

  return {
    enabled: Boolean(data.enabled),
    apiKey: apiKey || null,
  };
}

export async function isPlatformTripadvisorAvailableAdmin(): Promise<boolean> {
  const cfg = await fetchPlatformTripadvisorConfigAdmin();
  return cfg.enabled && Boolean(cfg.apiKey);
}
