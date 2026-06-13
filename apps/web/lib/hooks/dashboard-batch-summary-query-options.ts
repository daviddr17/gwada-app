"use client";

import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import {
  peekDashboardBatchSummaryCache,
  writeDashboardBatchSummaryCache,
} from "@/lib/dashboard/dashboard-batch-summary-cache";
import { fetchDashboardBatchSummaryClient } from "@/lib/dashboard/fetch-dashboard-batch-summary-client";
import {
  DASHBOARD_SUMMARY_GC_MS,
  DASHBOARD_SUMMARY_REFETCH_MS,
  DASHBOARD_SUMMARY_STALE_MS,
} from "@/lib/query/dashboard-query-policy";
import { queryKeys } from "@/lib/query/query-keys";
import type { DashboardBatchQueryData } from "@/lib/hooks/use-dashboard-batch-summary-query";

export async function fetchDashboardBatchQueryData(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
): Promise<DashboardBatchQueryData> {
  const result = await fetchDashboardBatchSummaryClient(restaurantId, widgets);
  if (result.error && !result.data) {
    throw new Error(result.error);
  }
  const payload: DashboardBatchQueryData = {
    data: result.data ?? {},
    errors: result.errors,
  };
  writeDashboardBatchSummaryCache(restaurantId, widgets, payload);
  return payload;
}

export function dashboardBatchSummaryQueryOptions(
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
) {
  return {
    queryKey: queryKeys.dashboard.summary(restaurantId, widgets),
    queryFn: async (): Promise<DashboardBatchQueryData> =>
      fetchDashboardBatchQueryData(restaurantId, widgets),
    staleTime: DASHBOARD_SUMMARY_STALE_MS,
    gcTime: DASHBOARD_SUMMARY_GC_MS,
    refetchInterval: () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
        ? DASHBOARD_SUMMARY_REFETCH_MS
        : false,
    refetchIntervalInBackground: false as const,
    placeholderData: (
      previousData: DashboardBatchQueryData | undefined,
    ): DashboardBatchQueryData | undefined => {
      if (previousData) return previousData;
      return peekDashboardBatchSummaryCache(restaurantId, widgets) ?? undefined;
    },
  };
}
