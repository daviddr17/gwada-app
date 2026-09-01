"use client";

import { useEffect, useMemo } from "react";
import { computeDashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import {
  setEmptyStockHeuteSnoozedIds,
  useEmptyStockHeuteSnoozedIds,
} from "@/lib/inventory/empty-stock-heute-snooze-client";
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
  const snoozedIds = useEmptyStockHeuteSnoozedIds(restaurantId);
  // Bei Batch-/Keep-alive-Pfad keine vollständigen Inventory-Queries.
  const { ingredients, isHydrated: ingredientsReady } = useIngredientsStorage({
    enabled: !useBatchSurface,
  });
  const { orders, isHydrated: ordersReady } = usePurchaseOrdersStorage({
    enabled: !useBatchSurface,
  });

  const todayYmd = restaurantTodayYmd(restaurantTimeZone);
  const standaloneSummary = useMemo(
    () =>
      computeDashboardInventorySummary(
        ingredients,
        orders,
        todayYmd,
        snoozedIds,
      ),
    [ingredients, orders, todayYmd, snoozedIds],
  );

  useEffect(() => {
    if (!restaurantId || !useBatchSurface) return;
    const ids = batchSlice.summary?.emptyStockSnoozedIngredientIds;
    if (!ids) return;
    setEmptyStockHeuteSnoozedIds(restaurantId, ids);
  }, [
    restaurantId,
    useBatchSurface,
    batchSlice.summary?.emptyStockSnoozedIngredientIds,
  ]);

  useEffect(() => {
    if (!restaurantId || useBatchSurface) return;
    let cancelled = false;
    void fetch(
      `/api/dashboard/inventory/empty-stock-heute-snooze?restaurantId=${encodeURIComponent(restaurantId)}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { ingredientIds?: string[] } | null) => {
        if (cancelled || !body?.ingredientIds) return;
        setEmptyStockHeuteSnoozedIds(restaurantId, body.ingredientIds);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [restaurantId, useBatchSurface]);

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
