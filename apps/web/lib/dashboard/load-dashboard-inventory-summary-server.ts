import "server-only";

import type { DashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardInventorySummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardInventorySummary> {
  const [{ data: ingredientRows }, { data: openOrders }] = await Promise.all([
    sb
      .from("inventory_ingredients")
      .select("current_stock, is_active")
      .eq("restaurant_id", restaurantId),
    sb
      .from("inventory_purchase_orders")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("status", "open"),
  ]);

  const activeRows = (ingredientRows ?? []).filter(
    (r) => (r.is_active as boolean) !== false,
  );
  const emptyStock = activeRows.filter(
    (r) => Number(r.current_stock) <= 0,
  ).length;

  const openOrderIds = (openOrders ?? []).map((o) => o.id as string);
  let openOrderLines = 0;
  if (openOrderIds.length > 0) {
    const { count } = await sb
      .from("inventory_purchase_order_lines")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .in("order_id", openOrderIds);
    openOrderLines = count ?? 0;
  }

  return {
    ingredientsActive: activeRows.length,
    emptyStock,
    openOrders: openOrderIds.length,
    openOrderLines,
  };
}
