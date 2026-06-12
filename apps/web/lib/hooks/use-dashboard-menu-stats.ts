"use client";

import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useDashboardMenuStats() {
  const batchEnabled = useDashboardBatchQueryEnabled();
  const batchSlice = useDashboardBatchSlice("menu");
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  if (batchEnabled) {
    return {
      summary: batchSlice.summary,
      loading: batchSlice.loading,
      error: batchSlice.error,
      ready: batchSlice.ready,
    };
  }

  return {
    summary: null,
    loading: false,
    error: null,
    ready: workspaceReady && Boolean(restaurantId),
  };
}
