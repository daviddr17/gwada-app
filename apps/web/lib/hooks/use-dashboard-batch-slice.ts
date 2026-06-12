"use client";

import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type { DashboardBatchSummary } from "@/lib/dashboard/load-dashboard-batch-summary-server";
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

  if (!batchEnabled) {
    return {
      summary: null,
      loading: false,
      error: null,
      ready: false,
    };
  }

  const payload = query.data;
  const summary = (payload?.data[widget] ?? null) as NonNullable<
    DashboardBatchSummary[K]
  > | null;
  const widgetError = payload?.errors[widget] ?? null;
  const fatalError =
    query.error instanceof Error ? query.error.message : null;

  return {
    summary,
    loading: query.isLoading && summary == null && widgetError == null,
    error: widgetError ?? (summary == null ? fatalError : null),
    ready: batchEnabled,
  };
}
