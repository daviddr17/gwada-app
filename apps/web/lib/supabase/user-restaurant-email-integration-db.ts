import "server-only";

import {
  smtpConfigFromJson,
  smtpConfigToPublic,
  type SmtpIntegrationConfig,
} from "@/lib/integrations/smtp-integration-config";
import type { PersonalEmailIntegrationResponse } from "@/lib/types/restaurant-integration";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PersonalEmailStatus =
  | "disconnected"
  | "custom"
  | "gmail"
  | "outlook";

export type PersonalEmailIntegrationRow = {
  restaurant_id: string;
  user_id: string;
  status: PersonalEmailStatus;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  config: SmtpIntegrationConfig & {
    auth_mode?: "gmail_oauth" | "outlook_oauth";
    granted_scopes?: string[];
    passwordConfigured?: boolean;
  };
  updated_at: string;
};

function rowFromUi(data: Record<string, unknown> | null): PersonalEmailIntegrationRow | null {
  if (!data) return null;
  const configRaw = data.config;
  const smtp = smtpConfigFromJson(configRaw);
  const o =
    configRaw && typeof configRaw === "object" && !Array.isArray(configRaw)
      ? (configRaw as Record<string, unknown>)
      : {};
  return {
    restaurant_id: data.restaurant_id as string,
    user_id: data.user_id as string,
    status: data.status as PersonalEmailStatus,
    display_name: (data.display_name as string | null) ?? null,
    connected_at: (data.connected_at as string | null) ?? null,
    last_error: (data.last_error as string | null) ?? null,
    updated_at: data.updated_at as string,
    config: {
      ...smtpConfigToPublic(smtp),
      auth_mode:
        o.auth_mode === "gmail_oauth" || o.auth_mode === "outlook_oauth"
          ? o.auth_mode
          : undefined,
      granted_scopes: Array.isArray(o.granted_scopes)
        ? o.granted_scopes.filter((s): s is string => typeof s === "string")
        : undefined,
      passwordConfigured: o.passwordConfigured === true,
    },
  };
}

export async function fetchUserRestaurantEmailIntegrationUi(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<PersonalEmailIntegrationRow | null> {
  const { data, error } = await sb.rpc("user_restaurant_email_integration_ui", {
    p_restaurant_id: restaurantId,
  });
  if (error) {
    console.warn("fetchUserRestaurantEmailIntegrationUi", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return rowFromUi(row as Record<string, unknown> | null);
}

export async function fetchUserRestaurantEmailConfigAdmin(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{
  status: PersonalEmailStatus;
  config: SmtpIntegrationConfig & Record<string, unknown>;
} | null> {
  const { data, error } = await sb
    .from("user_restaurant_email_integrations")
    .select("status, config")
    .eq("restaurant_id", params.restaurantId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    status: data.status as PersonalEmailStatus,
    config: {
      ...smtpConfigFromJson(data.config),
      ...(typeof data.config === "object" && data.config && !Array.isArray(data.config)
        ? (data.config as Record<string, unknown>)
        : {}),
    },
  };
}

export async function upsertUserRestaurantEmailIntegration(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    status: PersonalEmailStatus;
    config: SmtpIntegrationConfig & Record<string, unknown>;
    lastError?: string | null;
  },
): Promise<{ error: string | null }> {
  const email =
    typeof params.config.email === "string" ? params.config.email : null;
  const connected =
    params.status === "custom" ||
    params.status === "gmail" ||
    params.status === "outlook";
  const { error } = await sb.from("user_restaurant_email_integrations").upsert(
    {
      restaurant_id: params.restaurantId,
      user_id: params.userId,
      status: params.status,
      display_name: email,
      connected_at: connected ? new Date().toISOString() : null,
      last_error: params.lastError ?? null,
      config: params.config,
    },
    { onConflict: "restaurant_id,user_id" },
  );
  return { error: error?.message ?? null };
}

export function personalEmailRowToResponse(
  row: PersonalEmailIntegrationRow | null,
  opts: {
    platformEmailEnabled: boolean;
    gmailOAuthConfigured: boolean;
    outlookOAuthConfigured: boolean;
  },
): PersonalEmailIntegrationResponse {
  const cfg = row?.config ?? {};
  return {
    configured: true,
    platformEmailEnabled: opts.platformEmailEnabled,
    gmailOAuthConfigured: opts.gmailOAuthConfigured,
    outlookOAuthConfigured: opts.outlookOAuthConfigured,
    status: row?.status ?? "disconnected",
    fromEmail: cfg.email ?? cfg.from_email ?? null,
    fromName: cfg.from_name ?? null,
    smtpHost: cfg.smtp_host ?? null,
    smtpPort: cfg.smtp_port != null ? String(cfg.smtp_port) : null,
    imapHost: cfg.imap_host ?? null,
    imapPort: cfg.imap_port != null ? String(cfg.imap_port) : null,
    passwordConfigured: Boolean(cfg.passwordConfigured),
    grantedScopes: Array.isArray(cfg.granted_scopes) ? cfg.granted_scopes : [],
  };
}
