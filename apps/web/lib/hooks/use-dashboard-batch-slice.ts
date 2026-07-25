"use client";

import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type { DashboardBatchSummary } from "@/lib/dashboard/load-dashboard-batch-summary-server";
import { useDashboardHomeKeepAliveOptional } from "@/lib/contexts/module-home-keep-alive-context";
import { useDashboardBatchQueryEnabled } from "@/lib/hooks/use-dashboard-batch-query-enabled";
import { useDashboardBatchSummaryQuery } from "@/lib/hooks/use-dashboard-batch-summary-query";

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
  /** Warm Home behält Cache-Anzeige auch wenn Batch (pathname) pausiert ist. */
  const retainWarm = Boolean(keepAlive?.warm);

  const payload = query.data;
  const summary = (payload?.data[widget] ?? null) as NonNullable<
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
      batchEnabled && query.isLoading && summary == null && widgetError == null,
    error: widgetError ?? (summary == null && batchEnabled ? fatalError : null),
    ready: batchEnabled || retainWarm,
  };
}
