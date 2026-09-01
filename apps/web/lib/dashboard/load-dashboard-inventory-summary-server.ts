import "server-only";

import type { DashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import { countPurchaseOrdersDeliveryDue } from "@/lib/inventory/purchase-order-delivery-due";
import { fetchEmptyStockHeuteSnoozedIngredientIds } from "@/lib/inventory/empty-stock-heute-snooze-server";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardInventorySummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardInventorySummary> {
  const [{ data: ingredientRows }, { data: orderRows }, timeZone, snoozedIds] =
    await Promise.all([
      sb
        .from("inventory_ingredients")
        .select("id, current_stock, is_active")
        .eq("restaurant_id", restaurantId),
      sb
        .from("inventory_purchase_orders")
        .select("id, status, delivery_date")
        .eq("restaurant_id", restaurantId),
      fetchRestaurantTimezoneServer(sb, restaurantId),
      fetchEmptyStockHeuteSnoozedIngredientIds(sb, restaurantId),
    ]);

  // Heute empty-stock: inactive (`is_active = false`) must not count.
  const activeRows = (ingredientRows ?? []).filter(
    (r) => (r.is_active as boolean) !== false,
  );
  const emptyActive = activeRows.filter(
    (r) => Number(r.current_stock) <= 0,
  );
  const emptyStockSnoozed = emptyActive.filter((r) =>
    snoozedIds.has(r.id as string),
  ).length;
  const emptyStock = emptyActive.filter(
    (r) => !snoozedIds.has(r.id as string),
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

  const todayYmd = restaurantTodayYmd(timeZone);
  const due = countPurchaseOrdersDeliveryDue(
    allOrders.map((o) => ({
      status: o.status as "open" | "ordered" | "closed",
      deliveryDate:
        typeof o.delivery_date === "string" && o.delivery_date.length > 0
          ? o.delivery_date
          : null,
    })),
    todayYmd,
  );

  return {
    ingredientsActive: activeRows.length,
    emptyStock,
    emptyStockSnoozed,
    emptyStockSnoozedIngredientIds: emptyActive
      .filter((r) => snoozedIds.has(r.id as string))
      .map((r) => r.id as string),
    openOrders: actionable.length,
    openOrderLines,
    allOrders: allOrders.length,
    allOrderLines,
    deliveriesDueToday: due.deliveriesDueToday,
    deliveriesOverdue: due.deliveriesOverdue,
  };
}
