import "server-only";

import { fetchPublicEmbedMenu } from "@/lib/menu/public-menu-server";
import type { PublicOrderingRecipeIngredient } from "@/lib/ordering/online-ordering-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { PublicOrderingRecipeIngredient };

/** Public menu plus recipe ingredients for guest „ohne“ selection. */
export async function fetchPublicOrderingMenu(slug: string) {
  const menuResult = await fetchPublicEmbedMenu(slug);
  if (!menuResult.data) return menuResult;

  const admin = createSupabaseAdminClient();
  if (!admin) return menuResult;

  const itemIds = menuResult.data.items.map((i) => i.id);
  if (!itemIds.length) {
    return {
      data: { ...menuResult.data, recipeByItemId: {} as Record<string, PublicOrderingRecipeIngredient[]> },
      error: null,
    };
  }

  const { data: lines } = await admin
    .from("menu_item_recipe_lines")
    .select("menu_item_id, ingredient_id, amount, sort_order, ingredients(id, name)")
    .in("menu_item_id", itemIds);

  const recipeByItemId: Record<string, PublicOrderingRecipeIngredient[]> = {};
  for (const row of lines ?? []) {
    const itemId = row.menu_item_id as string;
    const ing = row.ingredients as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const ingredient = Array.isArray(ing) ? ing[0] : ing;
    if (!ingredient?.id || !ingredient.name) continue;
    const list = recipeByItemId[itemId] ?? [];
    list.push({
      ingredientId: ingredient.id,
      name: ingredient.name,
    });
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
