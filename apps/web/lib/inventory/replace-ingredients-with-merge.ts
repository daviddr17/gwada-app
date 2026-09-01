import { mergeIngredientsForReplace } from "@/lib/inventory/merge-ingredients-for-replace";
import type { Ingredient } from "@/lib/types/inventory";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reloads DB ingredients, merges with the client snapshot, then calls
 * `inventory_replace_ingredients`. Shared by server paths (POS, accounting).
 */
export async function replaceIngredientsWithMerge(
  sb: SupabaseClient,
  restaurantId: string,
  clientIngredients: Ingredient[],
  loadFresh: (
    sb: SupabaseClient,
    restaurantId: string,
  ) => Promise<Ingredient[] | null>,
): Promise<{ error: string | null }> {
  const fresh = (await loadFresh(sb, restaurantId)) ?? [];
  const merged = mergeIngredientsForReplace(fresh, clientIngredients);
  const { error } = await sb.rpc("inventory_replace_ingredients", {
    p_restaurant_id: restaurantId,
    p_ingredients: merged,
  });
  return { error: error?.message ?? null };
}
