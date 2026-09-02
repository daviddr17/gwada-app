"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useInventoryDataRefreshListener } from "@/lib/hooks/use-inventory-data-refresh-listener";
import { invalidateInventoryQueries } from "@/lib/query/module-query-invalidation";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { inventoryRelationalPersistenceEnabled } from "@/lib/supabase/inventory-db";

/** Invalidiert Bestand-Queries app-weit — auch wenn kein Inventory-Screen gemountet ist. */
export function useInventoryGlobalQueryInvalidation() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const useDbInventory = inventoryRelationalPersistenceEnabled();

  useInventoryDataRefreshListener(
    useDbInventory && workspaceReady && Boolean(restaurantId),
    () => {
      if (!restaurantId) return;
      invalidateInventoryQueries(queryClient, restaurantId);
    },
  );
}
