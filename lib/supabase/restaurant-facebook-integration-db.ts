import {
  facebookIntegrationConfigFromJson,
  type FacebookIntegrationConfig,
} from "@/lib/integrations/facebook-oauth";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantFacebookStatus = "disconnected" | "working";

export type RestaurantFacebookIntegrationRow = {
  restaurant_id: string;
  integration_key: "facebook";
  status: RestaurantFacebookStatus;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  config: FacebookIntegrationConfig;
  updated_at: string;
};

const FACEBOOK_KEY = "facebook" as const;

export async function fetchRestaurantFacebookIntegration(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantFacebookIntegrationRow | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select(
      "restaurant_id, integration_key, status, display_name, connected_at, last_error, config, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", FACEBOOK_KEY)
    .maybeSingle();

  if (error) {
    console.warn("fetchRestaurantFacebookIntegration", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    restaurant_id: row.restaurant_id as string,
    integration_key: "facebook",
    status: row.status as RestaurantFacebookStatus,
    display_name: (row.display_name as string | null) ?? null,
    connected_at: (row.connected_at as string | null) ?? null,
    last_error: (row.last_error as string | null) ?? null,
    config: facebookIntegrationConfigFromJson(row.config),
    updated_at: row.updated_at as string,
  };
}

export async function upsertRestaurantFacebookIntegration(
  sb: SupabaseClient,
  restaurantId: string,
  patch: {
    status: RestaurantFacebookStatus;
    display_name?: string | null;
    connected_at?: string | null;
    last_error?: string | null;
    config?: FacebookIntegrationConfig;
  },
): Promise<{ error: string | null }> {
  const existing = await fetchRestaurantFacebookIntegration(sb, restaurantId);
  const config = patch.config ?? existing?.config ?? {};

  const { error } = await sb.from("restaurant_integrations").upsert(
    {
      restaurant_id: restaurantId,
      integration_key: FACEBOOK_KEY,
      waha_session_name: "facebook",
      status: patch.status,
      phone_number: null,
      display_name: patch.display_name ?? null,
      connected_at: patch.connected_at ?? null,
      last_error: patch.last_error ?? null,
      config,
    },
    { onConflict: "restaurant_id,integration_key" },
  );
  return { error: error?.message ?? null };
}
