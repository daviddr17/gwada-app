"use client";

import { useMemo } from "react";
import { computeDashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import { useDashboardHomeBatchSurface } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";

export function useDashboardInventoryStats() {
  const useBatchSurface = useDashboardHomeBatchSurface();
  const batchSlice = useDashboardBatchSlice("inventory");
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  // Bei Batch-/Keep-alive-Pfad keine vollständigen Inventory-Queries.
  const { ingredients, isHydrated: ingredientsReady } = useIngredientsStorage({
    enabled: !useBatchSurface,
  });
  const { orders, isHydrated: ordersReady } = usePurchaseOrdersStorage({
    enabled: !useBatchSurface,
  });

  const todayYmd = restaurantTodayYmd(restaurantTimeZone);
  const standaloneSummary = useMemo(
    () => computeDashboardInventorySummary(ingredients, orders, todayYmd),
    [ingredients, orders, todayYmd],
  );

  if (useBatchSurface) {
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
    ready: workspaceReady && !loading,
  };
}
