import "server-only";

import {
  normalizeWahaBaseUrl,
  whatsappConfigFromJson,
} from "@/lib/integrations/platform-whatsapp-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WahaServerConfig } from "@/lib/waha/waha-config";

/** WAHA-Zugangsdaten — nur Service-Role, nie an Restaurant-Clients. */
export async function fetchPlatformWhatsappWahaConfigAdmin(): Promise<{
  enabled: boolean;
  waha: WahaServerConfig | null;
}> {
  const sb = createSupabaseAdminClient();
  if (!sb) return { enabled: false, waha: null };

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "whatsapp")
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformWhatsappWahaConfigAdmin", error?.message);
    return { enabled: false, waha: null };
  }

  const cfg = whatsappConfigFromJson(data.config);
  const baseUrl = cfg.waha_base_url
    ? normalizeWahaBaseUrl(cfg.waha_base_url)
    : "";
  const apiKey = cfg.waha_api_key?.trim() ?? "";

  if (!baseUrl || !apiKey) {
    return { enabled: Boolean(data.enabled), waha: null };
  }

  return {
    enabled: Boolean(data.enabled),
    waha: { baseUrl, apiKey },
  };
}
