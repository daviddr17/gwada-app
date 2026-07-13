import {
  tripadvisorRestaurantConfigFromJson,
  tripadvisorRestaurantConfigToPublic,
  type TripadvisorRestaurantConfig,
} from "@/lib/integrations/platform-tripadvisor-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRIPADVISOR_KEY = "tripadvisor" as const;

export type RestaurantTripadvisorStatus = "disconnected" | "working";

export type RestaurantTripadvisorIntegrationRow = {
  restaurant_id: string;
  integration_key: typeof TRIPADVISOR_KEY;
  status: RestaurantTripadvisorStatus;
  config: ReturnType<typeof tripadvisorRestaurantConfigToPublic>;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type RestaurantTripadvisorConfigRow = {
  status: RestaurantTripadvisorStatus;
  config: TripadvisorRestaurantConfig;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
};

function rowToTripadvisorIntegration(
  data: Record<string, unknown> | null,
): RestaurantTripadvisorIntegrationRow | null {
  if (!data) return null;
  return {
    restaurant_id: data.restaurant_id as string,
    integration_key: TRIPADVISOR_KEY,
    status: data.status as RestaurantTripadvisorStatus,
    config: tripadvisorRestaurantConfigToPublic(
      tripadvisorRestaurantConfigFromJson(data.config),
    ),
    display_name: (data.display_name as string | null) ?? null,
    connected_at: (data.connected_at as string | null) ?? null,
    last_error: (data.last_error as string | null) ?? null,
    updated_at: data.updated_at as string,
  };
}

export async function fetchRestaurantTripadvisorIntegration(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantTripadvisorIntegrationRow | null> {
  const { data, error } = await sb.rpc("restaurant_tripadvisor_integration_ui", {
    p_restaurant_id: restaurantId,
  });

  if (error) {
    console.warn("fetchRestaurantTripadvisorIntegration", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return rowToTripadvisorIntegration(row as Record<string, unknown> | null);
}

async function fetchRestaurantTripadvisorConfigWithClient(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantTripadvisorConfigRow | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select("status, config, display_name, connected_at, last_error")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", TRIPADVISOR_KEY)
    .maybeSingle();

  if (error || !data) return null;
  return {
    status: data.status as RestaurantTripadvisorStatus,
    config: tripadvisorRestaurantConfigFromJson(data.config),
    display_name: (data.display_name as string | null) ?? null,
    connected_at: (data.connected_at as string | null) ?? null,
    last_error: (data.last_error as string | null) ?? null,
  };
}

export async function fetchRestaurantTripadvisorConfigAdmin(
  restaurantId: string,
): Promise<RestaurantTripadvisorConfigRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  return fetchRestaurantTripadvisorConfigWithClient(admin, restaurantId);
}

export async function upsertRestaurantTripadvisorIntegration(
  sb: SupabaseClient,
  restaurantId: string,
  patch: {
    status: RestaurantTripadvisorStatus;
    config: TripadvisorRestaurantConfig;
    display_name?: string | null;
    connected_at?: string | null;
    last_error?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb.from("restaurant_integrations").upsert(
    {
      restaurant_id: restaurantId,
      integration_key: TRIPADVISOR_KEY,
      waha_session_name: TRIPADVISOR_KEY,
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
