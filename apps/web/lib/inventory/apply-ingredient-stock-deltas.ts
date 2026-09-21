import type { SupabaseClient } from "@supabase/supabase-js";

export type IngredientStockDeltaItem = {
  ingredientId: string;
  delta: number;
  stockLog: Record<string, unknown>;
};

export async function applyIngredientStockDeltas(
  sb: SupabaseClient,
  restaurantId: string,
  items: IngredientStockDeltaItem[],
): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  const payload = items
    .filter((item) => item.ingredientId && item.delta !== 0)
    .map((item) => ({
      ingredient_id: item.ingredientId,
      delta: item.delta,
      stock_log: item.stockLog,
    }));
  if (payload.length === 0) {
    return { ok: true, updated: 0 };
  }

  const { data, error } = await sb.rpc("inventory_ingredients_apply_stock_deltas", {
    p_restaurant_id: restaurantId,
    p_items: payload,
  });
  if (error) {
    console.warn(
      "[gwada] inventory_ingredients_apply_stock_deltas",
      error.message,
    );
    return {
      ok: false,
      message: error.message.trim() || "Bestand konnte nicht gespeichert werden.",
    };
  }
  const row = data && typeof data === "object" ? (data as { updated?: number }) : {};
  return { ok: true, updated: typeof row.updated === "number" ? row.updated : 0 };
}
