"use client";

import { useEffect } from "react";
import { markDashboardBatchMessagesFetched } from "@/lib/dashboard/dashboard-batch-warm-coordinator";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSummaryQuery } from "@/lib/hooks/use-dashboard-batch-summary-query";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

/**
 * Dashboard-Home: Batch-Warm-Koordination.
 * Live-Patches laufen app-weit über {@link AppDashboardLivePatchMount}.
 */
export function DashboardBatchQuerySync() {
  const enabled = useDashboardBatchQueryEnabled();
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const { visibility } = useDashboardEffectiveWidgetPrefs();
  const { data: batchData } = useDashboardBatchSummaryQuery();

  useEffect(() => {
    if (!enabled || !restaurantId || !visibility.messages || !batchData?.data?.messages) {
      return;
    }
    markDashboardBatchMessagesFetched(restaurantId);
  }, [batchData, enabled, restaurantId, visibility.messages]);

  return null;
}
