import "server-only";

import { isIngredientLowStock } from "@/lib/inventory/low-stock";
import type { SupabaseClient } from "@supabase/supabase-js";

async function fetchDismissedIngredientIds(
  sb: SupabaseClient,
  params: { profileId: string; restaurantId: string },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_inventory_low_stock_dismissals")
    .select("ingredient_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId);

  return new Set(
    (data ?? []).map((row) => (row as { ingredient_id: string }).ingredient_id),
  );
}

export async function loadInventoryLowStockBellSummary(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; limit?: number },
) {
  const dismissed = await fetchDismissedIngredientIds(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
  });

  const { data: ingredients, error: ingError } = await sb
    .from("inventory_ingredients")
    .select("id, name, unit, current_stock, low_stock_threshold, is_active, updated_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (ingError) {
    console.warn("[gwada] inventory low stock bell", ingError.message);
    return { items: [], totalCount: 0 };
  }

  const { data: units } = await sb
    .from("inventory_units")
    .select("id, name")
    .eq("restaurant_id", params.restaurantId);

  const unitLabels = new Map(
    (units ?? []).map((u) => [
      (u as { id: string }).id,
      (u as { name: string }).name,
    ]),
  );

  const limit = params.limit ?? 5;

  const lowStock = (ingredients ?? [])
    .map((row) => {
      const r = row as {
        id: string;
        name: string;
        unit: string;
        current_stock: number;
        low_stock_threshold: number;
        is_active: boolean;
        updated_at: string;
      };
      return {
        id: r.id,
        name: r.name,
        unit: r.unit,
        currentStock: Number(r.current_stock),
        lowStockThreshold: Number(r.low_stock_threshold ?? 0),
        active: r.is_active !== false,
        updatedAt: r.updated_at,
      };
    })
    .filter((ing) => isIngredientLowStock(ing))
    .filter((ing) => !dismissed.has(ing.id));

  const items = lowStock.slice(0, limit).map((ing) => {
    const unitLabel = unitLabels.get(ing.unit) ?? ing.unit;
    return {
      id: ing.id,
      title: ing.name,
      subtitle: `${ing.currentStock} ${unitLabel} (Schwelle ${ing.lowStockThreshold})`,
      href: "/dashboard/inventory/uebersicht",
      at: ing.updatedAt,
      meta: { ingredientId: ing.id },
    };
  });

  return { items, totalCount: lowStock.length };
}

export async function dismissInventoryLowStockNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    ingredientId: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_inventory_low_stock_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        ingredient_id: params.ingredientId,
      },
      { onConflict: "profile_id,restaurant_id,ingredient_id" },
    );

  return { error: error?.message ?? null };
}

export async function dismissAllInventoryLowStockNotifications(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null }> {
  const summary = await loadInventoryLowStockBellSummary(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    limit: 500,
  });

  if (summary.items.length === 0) return { error: null };

  const rows = summary.items.map((item) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    ingredient_id: item.id,
  }));

  const { error } = await sb
    .from("restaurant_inventory_low_stock_dismissals")
    .upsert(rows, { onConflict: "profile_id,restaurant_id,ingredient_id" });

  return { error: error?.message ?? null };
}
