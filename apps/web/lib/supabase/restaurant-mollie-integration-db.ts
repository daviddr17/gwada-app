import "server-only";

import {
  mollieIntegrationConfigFromJson,
  mollieIntegrationConfigToPublic,
  type MollieIntegrationConfig,
} from "@/lib/integrations/mollie-integration-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const MOLLIE_KEY = "mollie" as const;

export type RestaurantMollieIntegrationRow = {
  restaurant_id: string;
  integration_key: "mollie";
  status: string;
  config: ReturnType<typeof mollieIntegrationConfigToPublic>;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export async function fetchRestaurantMollieIntegration(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantMollieIntegrationRow | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select(
      "restaurant_id, integration_key, status, config, display_name, connected_at, last_error, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", MOLLIE_KEY)
    .maybeSingle();

  if (error || !data) return null;

  return {
    restaurant_id: data.restaurant_id as string,
    integration_key: "mollie",
    status: data.status as string,
    config: mollieIntegrationConfigToPublic(
      mollieIntegrationConfigFromJson(data.config),
    ),
    display_name: (data.display_name as string | null) ?? null,
    connected_at: (data.connected_at as string | null) ?? null,
    last_error: (data.last_error as string | null) ?? null,
    updated_at: data.updated_at as string,
  };
}

export async function fetchRestaurantMollieConfigAdmin(
  restaurantId: string,
): Promise<MollieIntegrationConfig | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("restaurant_integrations")
    .select("status, config")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", MOLLIE_KEY)
    .maybeSingle();

  if (!data || data.status !== "working") return null;
  return mollieIntegrationConfigFromJson(data.config);
}

export async function upsertRestaurantMollieIntegration(params: {
  restaurantId: string;
  status: string;
  config: MollieIntegrationConfig;
  displayName?: string | null;
  lastError?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("admin_unavailable");

  const now = new Date().toISOString();
  const { error } = await admin.from("restaurant_integrations").upsert(
    {
      restaurant_id: params.restaurantId,
      integration_key: MOLLIE_KEY,
      status: params.status,
      config: params.config,
      display_name: params.displayName ?? null,
      connected_at: params.status === "working" ? now : null,
      last_error: params.lastError ?? null,
      updated_at: now,
    },
    { onConflict: "restaurant_id,integration_key" },
  );

  if (error) throw new Error(error.message);
}
