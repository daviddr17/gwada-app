import "server-only";

import type { DashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardInventorySummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardInventorySummary> {
  const [{ data: ingredientRows }, { data: orderRows }] = await Promise.all([
    sb
      .from("inventory_ingredients")
      .select("current_stock, is_active")
      .eq("restaurant_id", restaurantId),
    sb
      .from("inventory_purchase_orders")
      .select("id, status")
      .eq("restaurant_id", restaurantId),
  ]);

  const activeRows = (ingredientRows ?? []).filter(
    (r) => (r.is_active as boolean) !== false,
  );
  const emptyStock = activeRows.filter(
    (r) => Number(r.current_stock) <= 0,
  ).length;

  const allOrders = orderRows ?? [];
  const actionable = allOrders.filter(
    (o) => o.status === "open" || o.status === "ordered",
  );
  const actionableIds = actionable.map((o) => o.id as string);
  const allIds = allOrders.map((o) => o.id as string);

  let openOrderLines = 0;
  let allOrderLines = 0;
  if (allIds.length > 0) {
    const { data: lineRows } = await sb
      .from("inventory_purchase_order_lines")
      .select("order_id")
      .eq("restaurant_id", restaurantId)
      .in("order_id", allIds);
    const actionableSet = new Set(actionableIds);
    for (const row of lineRows ?? []) {
      allOrderLines += 1;
      if (actionableSet.has(row.order_id as string)) openOrderLines += 1;
    }
  }

  return {
    ingredientsActive: activeRows.length,
    emptyStock,
    openOrders: actionable.length,
    openOrderLines,
    allOrders: allOrders.length,
    allOrderLines,
  };
}
