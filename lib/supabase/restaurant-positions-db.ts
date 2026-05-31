import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantPositionRow = {
  id: string;
  restaurant_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  sort_order: number;
};

export async function fetchRestaurantPositions(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<{ rows: RestaurantPositionRow[]; error: string | null }> {
  const { data, error } = await sb
    .from("restaurant_positions")
    .select("id, restaurant_id, name, slug, description, is_system, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as RestaurantPositionRow[], error: null };
}

export async function fetchPositionPermissionKeys(
  sb: SupabaseClient,
  positionId: string,
): Promise<{ keys: RestaurantPermissionKey[]; error: string | null }> {
  const { data, error } = await sb
    .from("restaurant_position_permissions")
    .select("permission_key")
    .eq("position_id", positionId);
  if (error) return { keys: [], error: error.message };
  return {
    keys: (data ?? []).map((r) => r.permission_key as RestaurantPermissionKey),
    error: null,
  };
}

export async function createRestaurantPosition(
  sb: SupabaseClient,
  restaurantId: string,
  name: string,
  description: string | null,
): Promise<{ id: string | null; error: string | null }> {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `position-${Date.now()}`;

  const { data, error } = await sb
    .from("restaurant_positions")
    .insert({
      restaurant_id: restaurantId,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      is_system: false,
      sort_order: 100,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id as string, error: null };
}

export async function updatePositionPermissions(
  sb: SupabaseClient,
  positionId: string,
  keys: readonly RestaurantPermissionKey[],
): Promise<{ error: string | null }> {
  const { error: delErr } = await sb
    .from("restaurant_position_permissions")
    .delete()
    .eq("position_id", positionId);
  if (delErr) return { error: delErr.message };

  if (keys.length === 0) return { error: null };

  const { error: insErr } = await sb
    .from("restaurant_position_permissions")
    .insert(keys.map((permission_key) => ({ position_id: positionId, permission_key })));

  return { error: insErr?.message ?? null };
}

export async function seedRestaurantDefaultPositions(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<{ error: string | null }> {
  const { error } = await sb.rpc("seed_restaurant_default_positions", {
    p_restaurant_id: restaurantId,
  });
  return { error: error?.message ?? null };
}
