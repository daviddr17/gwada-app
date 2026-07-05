"use client";

import { dispatchDashboardWidgetLivePatch } from "@/lib/dashboard/dashboard-widgets-live-events";
import { computeDashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import { peekIngredientsCache } from "@/lib/inventory/ingredients-query";
import { peekPurchaseOrdersCache } from "@/lib/inventory/purchase-orders-query";

/** KPI-Kachel sofort aus Zutaten-/Bestell-LS-Cache — z. B. nach manuellem Bestand. */
export function dispatchDashboardInventoryLivePatchFromCache(
  restaurantId: string,
): void {
  dispatchDashboardWidgetLivePatch({
    restaurantId,
    widget: "inventory",
    summary: computeDashboardInventorySummary(
      peekIngredientsCache() ?? [],
      peekPurchaseOrdersCache(),
    ),
  });
}
