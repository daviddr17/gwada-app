"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { visibleDashboardBatchWidgets } from "@/lib/dashboard/dashboard-batch-widgets";
import { fetchDashboardBatchSummaryClient } from "@/lib/dashboard/fetch-dashboard-batch-summary-client";
import type { DashboardBatchSummaryErrors } from "@/lib/dashboard/load-dashboard-batch-summary-server";
import type { DashboardBatchSummary } from "@/lib/dashboard/load-dashboard-batch-summary-server";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  DASHBOARD_SUMMARY_GC_MS,
  DASHBOARD_SUMMARY_REFETCH_MS,
  DASHBOARD_SUMMARY_STALE_MS,
} from "@/lib/query/dashboard-query-policy";
import { queryKeys } from "@/lib/query/query-keys";

export type DashboardBatchQueryData = {
  data: DashboardBatchSummary;
  errors: DashboardBatchSummaryErrors;
};

export function useDashboardBatchSummaryQuery() {
  const enabled = useDashboardBatchQueryEnabled();
  const { visibility } = useDashboardWidgetPreferences();
  const { restaurantId } = useWorkspaceRestaurantUuid();

  const widgets = useMemo(
    () => visibleDashboardBatchWidgets(visibility),
    [visibility],
  );

  return useQuery({
    queryKey: queryKeys.dashboard.summary(restaurantId ?? "", widgets),
    queryFn: async (): Promise<DashboardBatchQueryData> => {
      const result = await fetchDashboardBatchSummaryClient(
        restaurantId!,
        widgets,
      );
      if (result.error && !result.data) {
        throw new Error(result.error);
      }
      return {
        data: result.data ?? {},
        errors: result.errors,
      };
    },
    enabled: enabled && Boolean(restaurantId),
    staleTime: DASHBOARD_SUMMARY_STALE_MS,
    gcTime: DASHBOARD_SUMMARY_GC_MS,
    refetchInterval: () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
        ? DASHBOARD_SUMMARY_REFETCH_MS
        : false,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}
