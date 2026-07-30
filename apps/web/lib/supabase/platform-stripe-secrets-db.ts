import "server-only";

import {
  stripeConfigFromJson,
  type PlatformStripeConfig,
} from "@/lib/integrations/platform-stripe-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PlatformStripeSecrets = PlatformStripeConfig & {
  enabled: boolean;
};

/** Stripe platform row — Service Role only. */
export async function fetchPlatformStripeConfigAdmin(): Promise<PlatformStripeSecrets> {
  const sb = createSupabaseAdminClient();
  if (!sb) {
    return { enabled: false };
  }

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "stripe")
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("fetchPlatformStripeConfigAdmin", error.message);
    return { enabled: false };
  }

  return {
    enabled: Boolean(data.enabled),
    ...stripeConfigFromJson(data.config),
  };
}

export async function fetchPlatformStripeSecretsAdmin(): Promise<PlatformStripeSecrets | null> {
  const platform = await fetchPlatformStripeConfigAdmin();
  if (!platform.secret_key) return null;
  return platform;
}
