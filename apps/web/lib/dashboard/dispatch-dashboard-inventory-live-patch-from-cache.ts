"use client";

import { dispatchDashboardWidgetLivePatch } from "@/lib/dashboard/dashboard-widgets-live-events";
import { computeDashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import {
  peekEmptyStockHeuteSnoozedIds,
  pruneEmptyStockHeuteSnoozesForIngredients,
} from "@/lib/inventory/empty-stock-heute-snooze-client";
import { peekIngredientsCache } from "@/lib/inventory/ingredients-query";
import { peekPurchaseOrdersCache } from "@/lib/inventory/purchase-orders-query";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantTodayYmd,
} from "@/lib/restaurant/restaurant-timezone";

/** KPI-Kachel sofort aus Zutaten-/Bestell-LS-Cache — z. B. nach manuellem Bestand. */
export function dispatchDashboardInventoryLivePatchFromCache(
  restaurantId: string,
): void {
  const ingredients = peekIngredientsCache() ?? [];
  pruneEmptyStockHeuteSnoozesForIngredients(restaurantId, ingredients);
  dispatchDashboardWidgetLivePatch({
    restaurantId,
    widget: "inventory",
    summary: computeDashboardInventorySummary(
      ingredients,
      peekPurchaseOrdersCache(),
      restaurantTodayYmd(DEFAULT_RESTAURANT_TIMEZONE),
      peekEmptyStockHeuteSnoozedIds(restaurantId),
    ),
  });
}
