import "server-only";

import {
  smtpConfigFromJson,
  type SmtpIntegrationConfig,
} from "@/lib/integrations/smtp-integration-config";
import { readPlatformIntegrationEnabled } from "@/lib/supabase/platform-integration-enabled";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformMessagingFlags = {
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  googleBusinessEnabled: boolean;
};

const PLATFORM_INTEGRATION_FLAG_KEYS = [
  "whatsapp",
  "email",
  "facebook",
  "instagram",
  "google_business",
] as const;

const ALL_DISABLED: PlatformMessagingFlags = {
  whatsappEnabled: false,
  emailEnabled: false,
  facebookEnabled: false,
  instagramEnabled: false,
  googleBusinessEnabled: false,
};

/** Liest nur `enabled` — keine Secrets (Service Role). */
async function fetchPlatformMessagingFlagsFromIntegrationsTable(): Promise<PlatformMessagingFlags | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("platform_integrations")
    .select("key, enabled")
    .in("key", [...PLATFORM_INTEGRATION_FLAG_KEYS]);

  if (error) {
    console.warn("platform_integrations enabled flags", error.message);
    return null;
  }

  const map = new Map(
    (data ?? []).map((row) => [
      row.key as string,
      readPlatformIntegrationEnabled(row.enabled),
    ]),
  );

  return {
    whatsappEnabled: map.get("whatsapp") ?? false,
    emailEnabled: map.get("email") ?? false,
    facebookEnabled: map.get("facebook") ?? false,
    instagramEnabled: map.get("instagram") ?? false,
    googleBusinessEnabled: map.get("google_business") ?? false,
  };
}

export async function fetchPlatformMessagingFlags(
  sb: SupabaseClient,
): Promise<PlatformMessagingFlags> {
  const fromTable = await fetchPlatformMessagingFlagsFromIntegrationsTable();
  if (fromTable) return fromTable;

  const { data, error } = await sb.rpc("platform_messaging_flags");
  if (error) {
    console.warn("platform_messaging_flags", error.message);
    return ALL_DISABLED;
  }
  const row = Array.isArray(data) ? data[0] : data;
  const r = row as
    | {
        whatsapp_enabled?: boolean;
        email_enabled?: boolean;
        facebook_enabled?: boolean;
        instagram_enabled?: boolean;
        google_business_enabled?: boolean;
      }
    | null
    | undefined;
  return {
    whatsappEnabled: readPlatformIntegrationEnabled(r?.whatsapp_enabled),
    emailEnabled: readPlatformIntegrationEnabled(r?.email_enabled),
    facebookEnabled: readPlatformIntegrationEnabled(r?.facebook_enabled),
    instagramEnabled: readPlatformIntegrationEnabled(r?.instagram_enabled),
    googleBusinessEnabled: readPlatformIntegrationEnabled(
      r?.google_business_enabled,
    ),
  };
}

export async function fetchPlatformIntegrationConfig(
  sb: SupabaseClient,
  key: "whatsapp" | "email",
): Promise<{ enabled: boolean; config: SmtpIntegrationConfig } | null> {
  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformIntegrationConfig", key, error?.message);
    return null;
  }

  return {
    enabled: readPlatformIntegrationEnabled(data.enabled),
    config: smtpConfigFromJson(data.config),
  };
}
