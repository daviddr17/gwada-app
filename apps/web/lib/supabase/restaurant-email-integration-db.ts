import {
  smtpConfigFromJson,
  smtpConfigToPublic,
  type SmtpIntegrationConfig,
} from "@/lib/integrations/smtp-integration-config";
import type {
  RestaurantEmailIntegrationConfig,
  RestaurantEmailIntegrationRow,
  RestaurantEmailStatus,
} from "@/lib/types/restaurant-integration";
import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_KEY = "email" as const;

export function parseRestaurantEmailSmtpConfig(
  raw: unknown,
): SmtpIntegrationConfig {
  return smtpConfigFromJson(raw);
}

export function emailIntegrationConfigToPublic(
  config: SmtpIntegrationConfig,
): RestaurantEmailIntegrationConfig {
  const pub = smtpConfigToPublic(config);
  return {
    ...pub,
    from_email: config.email ?? config.from_email,
    from_name: config.from_name,
  };
}

export function rowToEmailIntegration(
  data: Record<string, unknown> | null,
): RestaurantEmailIntegrationRow | null {
  if (!data) return null;
  return {
    restaurant_id: data.restaurant_id as string,
    integration_key: "email",
    status: data.status as RestaurantEmailStatus,
    config: emailIntegrationConfigToPublic(
      parseRestaurantEmailSmtpConfig(data.config),
    ),
    last_error: (data.last_error as string | null) ?? null,
    updated_at: data.updated_at as string,
  };
}

/** UI/API — ohne Passwort im Klartext (RPC). */
export async function fetchRestaurantEmailIntegration(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantEmailIntegrationRow | null> {
  const { data, error } = await sb.rpc("restaurant_email_integration_ui", {
    p_restaurant_id: restaurantId,
  });

  if (error) {
    console.warn("fetchRestaurantEmailIntegration", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return rowToEmailIntegration(row as Record<string, unknown> | null);
}

/** Vollständige SMTP-Config inkl. Passwort (nur Server / Service-Role). */
export async function fetchRestaurantEmailSmtpConfig(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<{
  status: RestaurantEmailStatus;
  config: SmtpIntegrationConfig;
} | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select("status, config")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", EMAIL_KEY)
    .maybeSingle();

  if (error || !data) return null;
  return {
    status: data.status as RestaurantEmailStatus,
    config: parseRestaurantEmailSmtpConfig(data.config),
  };
}

export async function upsertRestaurantEmailIntegration(
  sb: SupabaseClient,
  restaurantId: string,
  patch: {
    status: RestaurantEmailStatus;
    config: SmtpIntegrationConfig;
    last_error?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb.from("restaurant_integrations").upsert(
    {
      restaurant_id: restaurantId,
      integration_key: EMAIL_KEY,
      waha_session_name: "email",
      status: patch.status,
      phone_number: null,
      display_name: null,
      connected_at:
        patch.status === "custom" ? new Date().toISOString() : null,
      last_error: patch.last_error ?? null,
      config: patch.config,
    },
    { onConflict: "restaurant_id,integration_key" },
  );
  return { error: error?.message ?? null };
}
