import "server-only";

import { fetchPublicEmbedMenu } from "@/lib/menu/public-menu-server";
import type { PublicOrderingRecipeIngredient } from "@/lib/ordering/online-ordering-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { PublicOrderingRecipeIngredient };

/**
 * Public menu plus recipe ingredients for guest „ohne“ selection.
 * Ingredient ids are plain text (inventory_ingredients) — no PostgREST FK embed.
 */
export async function fetchPublicOrderingMenu(slug: string) {
  const menuResult = await fetchPublicEmbedMenu(slug);
  if (!menuResult.data) return menuResult;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      data: {
        ...menuResult.data,
        recipeByItemId: {} as Record<string, PublicOrderingRecipeIngredient[]>,
      },
      error: null,
    };
  }

  const itemIds = menuResult.data.items.map((i) => i.id);
  if (!itemIds.length) {
    return {
      data: {
        ...menuResult.data,
        recipeByItemId: {} as Record<string, PublicOrderingRecipeIngredient[]>,
      },
      error: null,
    };
  }

  const [{ data: lines }, { data: ingredientRows }] = await Promise.all([
    admin
      .from("menu_item_recipe_lines")
      .select("menu_item_id, ingredient_id, amount, sort_order")
      .in("menu_item_id", itemIds)
      .order("sort_order", { ascending: true }),
    admin
      .from("inventory_ingredients")
      .select("id, name")
      .eq("restaurant_id", menuResult.data.restaurantId)
      .eq("is_active", true),
  ]);

  const ingredientNameById = new Map(
    (ingredientRows ?? []).map((r) => [
      r.id as string,
      String(r.name ?? "").trim(),
    ]),
  );

  const recipeByItemId: Record<string, PublicOrderingRecipeIngredient[]> = {};
  for (const row of lines ?? []) {
    const itemId = row.menu_item_id as string;
    const ingredientId = String(row.ingredient_id ?? "");
    const name = ingredientNameById.get(ingredientId);
    if (!itemId || !ingredientId || !name) continue;
    const list = recipeByItemId[itemId] ?? [];
    list.push({ ingredientId, name });
    recipeByItemId[itemId] = list;
  }

  return {
    data: {
      ...menuResult.data,
      recipeByItemId,
    },
    error: null,
  };
}
