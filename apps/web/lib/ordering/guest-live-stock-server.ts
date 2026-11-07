import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GuestOrderLineInput } from "@/lib/ordering/online-ordering-types";

/**
 * Best-effort live stock gate for guest menu/checkout.
 * Does NOT deduct stock — that stays on POS inventory_booking_enabled.
 */
export async function menuItemIdsInsufficientStock(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  menuItemIds: string[];
}): Promise<Set<string>> {
  const ids = [...new Set(params.menuItemIds.filter(Boolean))];
  if (!ids.length) return new Set();

  const { data: lines, error } = await params.supabase
    .from("menu_item_recipe_lines")
    .select("menu_item_id, ingredient_id, amount")
    .in("menu_item_id", ids);

  if (error || !lines?.length) return new Set();

  const ingredientIds = [
    ...new Set(
      lines
        .map((l) => l.ingredient_id as string)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!ingredientIds.length) return new Set();

  const { data: ingredients } = await params.supabase
    .from("inventory_ingredients")
    .select("id, current_stock, restaurant_id")
    .in("id", ingredientIds)
    .eq("restaurant_id", params.restaurantId);

  const stockById = new Map<string, number>();
  for (const row of ingredients ?? []) {
    stockById.set(row.id as string, Number(row.current_stock) || 0);
  }

  const demandByItem = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const itemId = line.menu_item_id as string;
    const ingredientId = line.ingredient_id as string;
    const amount = Number(line.amount) || 0;
    if (!itemId || !ingredientId || amount <= 0) continue;
    const map = demandByItem.get(itemId) ?? new Map();
    map.set(ingredientId, (map.get(ingredientId) ?? 0) + amount);
    demandByItem.set(itemId, map);
  }

  const insufficient = new Set<string>();
  for (const [itemId, demand] of demandByItem) {
    for (const [ingredientId, need] of demand) {
      const have = stockById.get(ingredientId);
      if (have == null || have + 1e-9 < need) {
        insufficient.add(itemId);
        break;
      }
    }
  }
  return insufficient;
}

export async function assertGuestCartHasStock(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  items: GuestOrderLineInput[];
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const itemIds = [...new Set(params.items.map((i) => i.menuItemId))];
  if (!itemIds.length) return { ok: true };

  const { data: lines, error } = await params.supabase
    .from("menu_item_recipe_lines")
    .select("menu_item_id, ingredient_id, amount")
    .in("menu_item_id", itemIds);

  if (error) {
    console.warn("[ordering] live stock lines", error.message);
    return { ok: true };
  }
  if (!lines?.length) return { ok: true };

  const ingredientIds = [
    ...new Set(lines.map((l) => l.ingredient_id as string).filter(Boolean)),
  ];
  const { data: ingredients } = await params.supabase
    .from("inventory_ingredients")
    .select("id, current_stock")
    .in("id", ingredientIds)
    .eq("restaurant_id", params.restaurantId);

  const stockById = new Map<string, number>();
  for (const row of ingredients ?? []) {
    stockById.set(row.id as string, Number(row.current_stock) || 0);
  }

  const demand = new Map<string, number>();
  for (const cartLine of params.items) {
    const qty = Number(cartLine.quantity) || 0;
    if (qty <= 0) continue;
    const ohne = new Set(cartLine.ohneIngredientIds ?? []);
    for (const recipe of lines) {
      if ((recipe.menu_item_id as string) !== cartLine.menuItemId) continue;
      const ingredientId = recipe.ingredient_id as string;
      if (!ingredientId || ohne.has(ingredientId)) continue;
      const amount = (Number(recipe.amount) || 0) * qty;
      if (amount <= 0) continue;
      demand.set(ingredientId, (demand.get(ingredientId) ?? 0) + amount);
    }
  }

  for (const [ingredientId, need] of demand) {
    const have = stockById.get(ingredientId) ?? 0;
    if (have + 1e-9 < need) {
      return { ok: false, error: "insufficient_stock", status: 409 };
    }
  }
  return { ok: true };
}
