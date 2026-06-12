"use client";

import { useMemo } from "react";
import { computeDashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useDashboardInventoryStats() {
  const batchEnabled = useDashboardBatchQueryEnabled();
  const batchSlice = useDashboardBatchSlice("inventory");
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { ingredients, isHydrated: ingredientsReady } = useIngredientsStorage();
  const { orders, isHydrated: ordersReady } = usePurchaseOrdersStorage();

  const standaloneSummary = useMemo(
    () => computeDashboardInventorySummary(ingredients, orders),
    [ingredients, orders],
  );

  if (batchEnabled) {
    return {
      summary: batchSlice.summary,
      loading: batchSlice.loading,
      error: batchSlice.error,
      ready: batchSlice.ready,
    };
  }

  const loading = !ingredientsReady || !ordersReady;

  return {
    summary: standaloneSummary,
    loading,
    error: null as string | null,
    ready: workspaceReady && Boolean(restaurantId),
  };
}
