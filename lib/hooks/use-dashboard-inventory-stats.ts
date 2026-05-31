"use client";

import { useMemo } from "react";
import { computeDashboardInventorySummary } from "@/lib/inventory/compute-dashboard-inventory-summary";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useDashboardInventoryStats() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { ingredients, isHydrated: ingredientsReady } = useIngredientsStorage();
  const { orders, isHydrated: ordersReady } = usePurchaseOrdersStorage();

  const summary = useMemo(
    () => computeDashboardInventorySummary(ingredients, orders),
    [ingredients, orders],
  );

  const loading = !ingredientsReady || !ordersReady;

  return {
    summary,
    loading,
    error: null as string | null,
    ready: workspaceReady && Boolean(restaurantId),
  };
}
