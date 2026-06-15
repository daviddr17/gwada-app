import "server-only";

import { mollieConfigFromJson } from "@/lib/integrations/platform-mollie-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PlatformMollieSecrets = {
  enabled: boolean;
  apiKey: string | null;
  clientId: string | null;
  clientSecret: string | null;
  webhookSecret: string | null;
  profileId: string | null;
};

export async function fetchPlatformMollieConfigAdmin(): Promise<PlatformMollieSecrets> {
  const empty: PlatformMollieSecrets = {
    enabled: false,
    apiKey: null,
    clientId: null,
    clientSecret: null,
    webhookSecret: null,
    profileId: null,
  };

  const sb = createSupabaseAdminClient();
  if (!sb) return empty;

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "mollie")
    .maybeSingle();

  if (error || !data) return empty;

  const cfg = mollieConfigFromJson(data.config);
  return {
    enabled: Boolean(data.enabled),
    apiKey: cfg.api_key ?? null,
    clientId: cfg.client_id ?? null,
    clientSecret: cfg.client_secret ?? null,
    webhookSecret: cfg.webhook_secret ?? null,
    profileId: cfg.profile_id ?? null,
  };
}
