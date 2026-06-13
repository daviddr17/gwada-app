"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { visibleDashboardBatchWidgets } from "@/lib/dashboard/dashboard-batch-widgets";
import { dashboardBatchSummaryQueryOptions } from "@/lib/hooks/dashboard-batch-summary-query-options";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export type DashboardBatchQueryData = {
  data: import("@/lib/dashboard/load-dashboard-batch-summary-server").DashboardBatchSummary;
  errors: import("@/lib/dashboard/load-dashboard-batch-summary-server").DashboardBatchSummaryErrors;
};

export function useDashboardBatchSummaryQuery() {
  const enabled = useDashboardBatchQueryEnabled();
  const { visibility } = useDashboardWidgetPreferences();
  const { restaurantId } = useWorkspaceRestaurantUuid();

  const widgets = useMemo(
    () => visibleDashboardBatchWidgets(visibility),
    [visibility],
  );

  const options = useMemo(
    () => dashboardBatchSummaryQueryOptions(restaurantId ?? "", widgets),
    [restaurantId, widgets],
  );

  return useQuery({
    ...options,
    enabled: enabled && Boolean(restaurantId),
  });
}
