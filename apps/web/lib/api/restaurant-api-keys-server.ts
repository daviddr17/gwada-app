import "server-only";

import {
  generateRestaurantApiKeySecret,
  hashRestaurantApiKeySecret,
  restaurantApiKeyLookupPrefix,
} from "@/lib/api/restaurant-api-key-crypto";
import {
  normalizeRestaurantApiModuleIds,
  type RestaurantApiModuleId,
} from "@/lib/api/restaurant-api-modules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RestaurantApiKeyRow = {
  id: string;
  restaurant_id: string;
  name: string;
  key_prefix: string;
  enabled_modules: RestaurantApiModuleId[];
  allowed_origins: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function normalizeAllowedOrigins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    let origin = trimmed;
    if (!/^https?:\/\//i.test(origin)) {
      origin = `https://${origin.replace(/^\/\//, "")}`;
    }
    origin = origin.replace(/\/+$/, "");
    if (!out.includes(origin)) out.push(origin);
  }
  return out;
}

export function mapRestaurantApiKeyRow(row: Record<string, unknown>): RestaurantApiKeyRow {
  return {
    id: row.id as string,
    restaurant_id: row.restaurant_id as string,
    name: row.name as string,
    key_prefix: row.key_prefix as string,
    enabled_modules: normalizeRestaurantApiModuleIds(row.enabled_modules),
    allowed_origins: normalizeAllowedOrigins(row.allowed_origins),
    created_at: row.created_at as string,
    last_used_at: (row.last_used_at as string | null) ?? null,
    revoked_at: (row.revoked_at as string | null) ?? null,
  };
}

export async function listRestaurantApiKeys(
  restaurantId: string,
): Promise<RestaurantApiKeyRow[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("restaurant_api_keys")
    .select(
      "id, restaurant_id, name, key_prefix, enabled_modules, allowed_origins, created_at, last_used_at, revoked_at",
    )
    .eq("restaurant_id", restaurantId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) =>
    mapRestaurantApiKeyRow(row as Record<string, unknown>),
  );
}

export async function createRestaurantApiKey(input: {
  restaurantId: string;
  name: string;
  enabledModules: RestaurantApiModuleId[];
  allowedOrigins: string[];
  createdByProfileId: string;
}): Promise<
  | { ok: true; secret: string; key: RestaurantApiKeyRow }
  | { ok: false; error: string }
> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "invalid_name" };
  if (input.enabledModules.length === 0) {
    return { ok: false, error: "modules_required" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const secret = generateRestaurantApiKeySecret();
  const keyHash = hashRestaurantApiKeySecret(secret);
  const keyPrefix = restaurantApiKeyLookupPrefix(secret);

  const { data, error } = await admin
    .from("restaurant_api_keys")
    .insert({
      restaurant_id: input.restaurantId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      enabled_modules: input.enabledModules,
      allowed_origins: normalizeAllowedOrigins(input.allowedOrigins),
      created_by_profile_id: input.createdByProfileId,
    })
    .select(
      "id, restaurant_id, name, key_prefix, enabled_modules, allowed_origins, created_at, last_used_at, revoked_at",
    )
    .single();

  if (error || !data) {
    console.warn("[restaurant-api-keys] create", error?.message);
    return { ok: false, error: "create_failed" };
  }

  return {
    ok: true,
    secret,
    key: mapRestaurantApiKeyRow(data as Record<string, unknown>),
  };
}

export async function revokeRestaurantApiKey(
  restaurantId: string,
  keyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const { data, error } = await admin
    .from("restaurant_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("restaurant_id", restaurantId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[restaurant-api-keys] revoke", error.message);
    return { ok: false, error: "revoke_failed" };
  }
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

export { normalizeAllowedOrigins };
