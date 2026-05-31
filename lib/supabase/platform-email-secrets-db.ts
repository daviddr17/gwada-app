import {
  smtpConfigFromJson,
  type SmtpIntegrationConfig,
} from "@/lib/integrations/smtp-integration-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Plattform-SMTP (Fallback contact@gwada.app) — nur Service-Role.
 * Restaurant-Nutzer können platform_integrations per RLS nicht lesen.
 */
export async function fetchPlatformEmailSmtpConfigAdmin(): Promise<{
  enabled: boolean;
  config: SmtpIntegrationConfig;
} | null> {
  const sb = createSupabaseAdminClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "email")
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformEmailSmtpConfigAdmin", error?.message);
    return null;
  }

  return {
    enabled: Boolean(data.enabled),
    config: smtpConfigFromJson(data.config),
  };
}
