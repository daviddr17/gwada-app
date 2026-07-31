"use client";

import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type { DashboardBatchSummary } from "@/lib/dashboard/load-dashboard-batch-summary-server";
import { useDashboardBatchSlice } from "@/lib/hooks/use-dashboard-batch-slice";

/** Modul-Widgets laden nur über den Dashboard-Batch (kein Standalone-Fallback). */
export function useDashboardModuleBatchStats<K extends DashboardBatchWidgetId>(
  widget: K,
) {
  return useDashboardBatchSlice(widget) as {
    summary: NonNullable<DashboardBatchSummary[K]> | null;
    loading: boolean;
    error: string | null;
    ready: boolean;
  };
}
