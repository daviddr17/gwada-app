import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchEmptyStockHeuteSnoozedIngredientIds(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<Set<string>> {
  const { data, error } = await sb
    .from("restaurant_inventory_empty_stock_heute_snoozes")
    .select("ingredient_id")
    .eq("restaurant_id", restaurantId);

  if (error) {
    console.warn("[gwada] empty stock heute snoozes", error.message);
    return new Set();
  }

  return new Set(
    (data ?? []).map((row) => (row as { ingredient_id: string }).ingredient_id),
  );
}

export async function snoozeEmptyStockHeuteIngredient(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    ingredientId: string;
    profileId: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb.from("restaurant_inventory_empty_stock_heute_snoozes").upsert(
    {
      restaurant_id: params.restaurantId,
      ingredient_id: params.ingredientId,
      snoozed_by_profile_id: params.profileId,
      snoozed_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id,ingredient_id" },
  );

  return { error: error?.message ?? null };
}
