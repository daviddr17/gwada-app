"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { dashboardBatchSummaryQueryOptions } from "@/lib/hooks/dashboard-batch-summary-query-options";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export type DashboardBatchQueryData = {
  data: import("@/lib/dashboard/load-dashboard-batch-summary-server").DashboardBatchSummary;
  errors: import("@/lib/dashboard/load-dashboard-batch-summary-server").DashboardBatchSummaryErrors;
};

export function useDashboardBatchSummaryQuery() {
  const enabled = useDashboardBatchQueryEnabled();
  const { batchWidgets } = useDashboardEffectiveWidgetPrefs();
  const { restaurantId } = useWorkspaceRestaurantUuid();

  const options = useMemo(
    () => dashboardBatchSummaryQueryOptions(restaurantId ?? "", batchWidgets),
    [restaurantId, batchWidgets],
  );

  return useQuery({
    ...options,
    enabled: enabled && Boolean(restaurantId),
  });
}
