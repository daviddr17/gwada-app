import {
  appleBusinessConnectRestaurantConfigFromJson,
  appleBusinessConnectRestaurantConfigToPublic,
  type AppleBusinessConnectRestaurantConfig,
} from "@/lib/integrations/platform-apple-business-connect-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const APPLE_BC_KEY = "apple_business_connect" as const;

export type RestaurantAppleBusinessConnectStatus = "disconnected" | "working";

export type RestaurantAppleBusinessConnectIntegrationRow = {
  restaurant_id: string;
  integration_key: typeof APPLE_BC_KEY;
  status: RestaurantAppleBusinessConnectStatus;
  config: ReturnType<typeof appleBusinessConnectRestaurantConfigToPublic>;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type RestaurantAppleBusinessConnectConfigRow = {
  status: RestaurantAppleBusinessConnectStatus;
  config: AppleBusinessConnectRestaurantConfig;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
};

function rowToIntegration(
  data: Record<string, unknown> | null,
): RestaurantAppleBusinessConnectIntegrationRow | null {
  if (!data) return null;
  return {
    restaurant_id: data.restaurant_id as string,
    integration_key: APPLE_BC_KEY,
    status: data.status as RestaurantAppleBusinessConnectStatus,
    config: appleBusinessConnectRestaurantConfigToPublic(
      appleBusinessConnectRestaurantConfigFromJson(data.config),
    ),
    display_name: (data.display_name as string | null) ?? null,
    connected_at: (data.connected_at as string | null) ?? null,
    last_error: (data.last_error as string | null) ?? null,
    updated_at: data.updated_at as string,
  };
}

export async function fetchRestaurantAppleBusinessConnectIntegration(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantAppleBusinessConnectIntegrationRow | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select(
      "restaurant_id, integration_key, status, config, display_name, connected_at, last_error, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", APPLE_BC_KEY)
    .maybeSingle();

  if (error) {
    console.warn("fetchRestaurantAppleBusinessConnectIntegration", error.message);
    return null;
  }
  return rowToIntegration(data as Record<string, unknown> | null);
}

async function fetchConfigWithClient(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantAppleBusinessConnectConfigRow | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select("status, config, display_name, connected_at, last_error")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", APPLE_BC_KEY)
    .maybeSingle();

  if (error || !data) return null;
  return {
    status: data.status as RestaurantAppleBusinessConnectStatus,
    config: appleBusinessConnectRestaurantConfigFromJson(data.config),
    display_name: (data.display_name as string | null) ?? null,
    connected_at: (data.connected_at as string | null) ?? null,
    last_error: (data.last_error as string | null) ?? null,
  };
}

export async function fetchRestaurantAppleBusinessConnectConfigAdmin(
  restaurantId: string,
): Promise<RestaurantAppleBusinessConnectConfigRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  return fetchConfigWithClient(admin, restaurantId);
}

export async function upsertRestaurantAppleBusinessConnectIntegration(
  sb: SupabaseClient,
  restaurantId: string,
  patch: {
    status: RestaurantAppleBusinessConnectStatus;
    config: AppleBusinessConnectRestaurantConfig;
    display_name?: string | null;
    connected_at?: string | null;
    last_error?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb.from("restaurant_integrations").upsert(
    {
      restaurant_id: restaurantId,
      integration_key: APPLE_BC_KEY,
      waha_session_name: APPLE_BC_KEY,
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
