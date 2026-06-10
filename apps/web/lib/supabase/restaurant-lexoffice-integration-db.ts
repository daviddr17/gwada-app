import {
  lexofficeConfigFromJson,
  lexofficeConfigToPublic,
  type LexofficeIntegrationConfig,
} from "@/lib/integrations/lexoffice-integration-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  RestaurantLexofficeIntegrationRow,
  RestaurantLexofficeStatus,
} from "@/lib/types/restaurant-integration";
import type { SupabaseClient } from "@supabase/supabase-js";

const LEXOFFICE_KEY = "lexoffice" as const;

export function rowToLexofficeIntegration(
  data: Record<string, unknown> | null,
): RestaurantLexofficeIntegrationRow | null {
  if (!data) return null;
  return {
    restaurant_id: data.restaurant_id as string,
    integration_key: "lexoffice",
    status: data.status as RestaurantLexofficeStatus,
    config: lexofficeConfigToPublic(lexofficeConfigFromJson(data.config)),
    display_name: (data.display_name as string | null) ?? null,
    connected_at: (data.connected_at as string | null) ?? null,
    last_error: (data.last_error as string | null) ?? null,
    updated_at: data.updated_at as string,
  };
}

export async function fetchRestaurantLexofficeIntegration(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantLexofficeIntegrationRow | null> {
  const { data, error } = await sb.rpc("restaurant_lexoffice_integration_ui", {
    p_restaurant_id: restaurantId,
  });

  if (error) {
    console.warn("fetchRestaurantLexofficeIntegration", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return rowToLexofficeIntegration(row as Record<string, unknown> | null);
}

export type RestaurantLexofficeConfigRow = {
  status: RestaurantLexofficeStatus;
  config: LexofficeIntegrationConfig;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
};

async function fetchRestaurantLexofficeConfigWithClient(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantLexofficeConfigRow | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select("status, config, display_name, connected_at, last_error")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", LEXOFFICE_KEY)
    .maybeSingle();

  if (error || !data) return null;
  return {
    status: data.status as RestaurantLexofficeStatus,
    config: lexofficeConfigFromJson(data.config),
    display_name: (data.display_name as string | null) ?? null,
    connected_at: (data.connected_at as string | null) ?? null,
    last_error: (data.last_error as string | null) ?? null,
  };
}

export async function fetchRestaurantLexofficeConfig(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantLexofficeConfigRow | null> {
  return fetchRestaurantLexofficeConfigWithClient(sb, restaurantId);
}

/** Server-seitig: API-Key für Lexware-Aufrufe (Service Role). */
export async function fetchRestaurantLexofficeConfigAdmin(
  restaurantId: string,
): Promise<RestaurantLexofficeConfigRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  return fetchRestaurantLexofficeConfigWithClient(admin, restaurantId);
}

export async function fetchRestaurantLexofficeApiKey(
  restaurantId: string,
): Promise<string | null> {
  const row = await fetchRestaurantLexofficeConfigAdmin(restaurantId);
  if (!row || row.status !== "working") return null;
  const key = row.config.api_key?.trim();
  return key || null;
}

export async function upsertRestaurantLexofficeIntegration(
  sb: SupabaseClient,
  restaurantId: string,
  patch: {
    status: RestaurantLexofficeStatus;
    config: LexofficeIntegrationConfig;
    display_name?: string | null;
    connected_at?: string | null;
    last_error?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb.from("restaurant_integrations").upsert(
    {
      restaurant_id: restaurantId,
      integration_key: LEXOFFICE_KEY,
      waha_session_name: LEXOFFICE_KEY,
      status: patch.status,
      phone_number: null,
      display_name: patch.display_name ?? null,
      connected_at: patch.connected_at ?? null,
      last_error: patch.last_error ?? null,
      config: patch.config,
    },
    { onConflict: "restaurant_id,integration_key" },
  );
  return { error: error?.message ?? null };
}
