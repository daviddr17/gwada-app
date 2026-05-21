import type {
  PlatformIntegrationConfig,
  PlatformIntegrationKey,
  PlatformIntegrationRow,
} from "@/lib/types/platform-integration";
import { integrationConfigFromJson } from "@/lib/types/platform-integration";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SuperadminUserRow = {
  profile_id: string;
  email: string | null;
  given_name: string | null;
  family_name: string | null;
  display_name: string | null;
  phone: string | null;
  locale: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  restaurant_count: number;
};

export type SuperadminRestaurantRow = {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  is_published: boolean;
  brand_accent_hex: string | null;
  owner_email: string | null;
  owner_display_name: string | null;
  employee_count: number;
  created_at: string;
};

export async function fetchIsSuperadmin(
  sb: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await sb.rpc("auth_is_superadmin");
  if (error) {
    console.warn("auth_is_superadmin", error);
    return false;
  }
  return Boolean(data);
}

export async function fetchSuperadminUsers(
  sb: SupabaseClient,
): Promise<{ rows: SuperadminUserRow[]; error: string | null }> {
  const { data, error } = await sb.rpc("superadmin_list_users");
  if (error) return { rows: [], error: error.message };
  const rows = (data ?? []) as SuperadminUserRow[];
  return { rows, error: null };
}

export async function fetchSuperadminRestaurants(
  sb: SupabaseClient,
): Promise<{ rows: SuperadminRestaurantRow[]; error: string | null }> {
  const { data, error } = await sb.rpc("superadmin_list_restaurants");
  if (error) return { rows: [], error: error.message };
  const rows = (data ?? []) as SuperadminRestaurantRow[];
  return { rows, error: null };
}

export async function fetchPlatformIntegrations(
  sb: SupabaseClient,
): Promise<{ rows: PlatformIntegrationRow[]; error: string | null }> {
  const { data, error } = await sb
    .from("platform_integrations")
    .select("key, enabled, config, updated_at")
    .order("key");
  if (error) return { rows: [], error: error.message };
  const rows: PlatformIntegrationRow[] = (data ?? []).map((r) => ({
    key: r.key as PlatformIntegrationKey,
    enabled: Boolean(r.enabled),
    config: integrationConfigFromJson(r.config),
    updated_at: r.updated_at as string,
  }));
  return { rows, error: null };
}

export async function upsertPlatformIntegration(
  sb: SupabaseClient,
  key: PlatformIntegrationKey,
  enabled: boolean,
  config: PlatformIntegrationConfig,
): Promise<{ error: string | null }> {
  const { error } = await sb.from("platform_integrations").upsert({
    key,
    enabled,
    config,
  });
  return { error: error?.message ?? null };
}
