import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantOAuthStatus = "disconnected" | "working";

export type RestaurantOAuthIntegrationKey =
  | "facebook"
  | "instagram"
  | "google_business";

export async function fetchRestaurantOAuthIntegration<TConfig>(
  sb: SupabaseClient,
  restaurantId: string,
  integrationKey: RestaurantOAuthIntegrationKey,
  parseConfig: (raw: unknown) => TConfig,
): Promise<{
  restaurant_id: string;
  integration_key: RestaurantOAuthIntegrationKey;
  status: RestaurantOAuthStatus;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  config: TConfig;
  updated_at: string;
} | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select(
      "restaurant_id, integration_key, status, display_name, connected_at, last_error, config, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", integrationKey)
    .maybeSingle();

  if (error) {
    console.warn(`fetchRestaurantOAuthIntegration ${integrationKey}`, error.message);
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    restaurant_id: row.restaurant_id as string,
    integration_key: integrationKey,
    status: row.status as RestaurantOAuthStatus,
    display_name: (row.display_name as string | null) ?? null,
    connected_at: (row.connected_at as string | null) ?? null,
    last_error: (row.last_error as string | null) ?? null,
    config: parseConfig(row.config),
    updated_at: row.updated_at as string,
  };
}

export async function upsertRestaurantOAuthIntegration<TConfig extends object>(
  sb: SupabaseClient,
  restaurantId: string,
  integrationKey: RestaurantOAuthIntegrationKey,
  patch: {
    status: RestaurantOAuthStatus;
    display_name?: string | null;
    connected_at?: string | null;
    last_error?: string | null;
    config?: TConfig;
  },
  parseConfig: (raw: unknown) => TConfig,
  mergeConfig: (existing: TConfig, patch: TConfig | undefined) => TConfig,
): Promise<{ error: string | null }> {
  const existing = await fetchRestaurantOAuthIntegration(
    sb,
    restaurantId,
    integrationKey,
    parseConfig,
  );
  const config = mergeConfig(existing?.config ?? ({} as TConfig), patch.config);

  const { error } = await sb.from("restaurant_integrations").upsert(
    {
      restaurant_id: restaurantId,
      integration_key: integrationKey,
      waha_session_name: integrationKey,
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

export async function fetchRestaurantOAuthIntegrationAdmin<TConfig>(
  restaurantId: string,
  integrationKey: RestaurantOAuthIntegrationKey,
  parseConfig: (raw: unknown) => TConfig,
): Promise<Awaited<
  ReturnType<typeof fetchRestaurantOAuthIntegration<TConfig>>
> | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  return fetchRestaurantOAuthIntegration(
    admin,
    restaurantId,
    integrationKey,
    parseConfig,
  );
}
