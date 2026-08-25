"use client";

import { useMemo } from "react";
import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import { peekDashboardBatchSummaryCache } from "@/lib/dashboard/dashboard-batch-summary-cache";
import type { DashboardBatchSummary } from "@/lib/dashboard/load-dashboard-batch-summary-server";
import { useDashboardHomeKeepAliveOptional } from "@/lib/contexts/module-home-keep-alive-context";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSummaryQuery } from "@/lib/hooks/use-dashboard-batch-summary-query";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export type DashboardSummarySliceState<T> = {
  summary: T | null;
  loading: boolean;
  error: string | null;
  ready: boolean;
};

export function useDashboardBatchSlice<K extends DashboardBatchWidgetId>(
  widget: K,
): DashboardSummarySliceState<NonNullable<DashboardBatchSummary[K]>> {
  const batchEnabled = useDashboardBatchQueryEnabled();
  const query = useDashboardBatchSummaryQuery();
  const keepAlive = useDashboardHomeKeepAliveOptional();
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const { batchWidgets } = useDashboardEffectiveWidgetPrefs();
  /** Warm Home behält Cache-Anzeige auch wenn Batch (pathname) pausiert ist. */
  const retainWarm = Boolean(keepAlive?.warm);

  const payload = query.data;
  const cachedSummary = useMemo(() => {
    if (!restaurantId) return null;
    return peekDashboardBatchSummaryCache(restaurantId, batchWidgets)?.data[
      widget
    ] as NonNullable<DashboardBatchSummary[K]> | null | undefined;
  }, [restaurantId, batchWidgets, widget]);

  const summary = (payload?.data[widget] ?? cachedSummary ?? null) as NonNullable<
    DashboardBatchSummary[K]
  > | null;
  const widgetError = payload?.errors[widget] ?? null;
  const fatalError =
    query.error instanceof Error ? query.error.message : null;

  if (!batchEnabled && !retainWarm) {
    return {
      summary: null,
      loading: false,
      error: null,
      ready: false,
    };
  }

  return {
    summary,
    loading:
      batchEnabled &&
      summary == null &&
      widgetError == null &&
      query.isLoading,
    error: widgetError ?? (summary == null && batchEnabled && !query.isFetching ? fatalError : null),
    ready: batchEnabled || retainWarm,
  };
}
