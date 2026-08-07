import {
  DASHBOARD_BATCH_WIDGET_IDS,
  type DashboardBatchWidgetId,
} from "@/lib/dashboard/dashboard-batch-widgets";
import { DASHBOARD_HEUTE_BATCH_WIDGET_IDS } from "@/lib/dashboard/dashboard-heute-batch-deps";
import type {
  DashboardBatchSummary,
  DashboardBatchSummaryErrors,
} from "@/lib/dashboard/load-dashboard-batch-summary-server";

const PRIORITY_SET = new Set<string>(DASHBOARD_HEUTE_BATCH_WIDGET_IDS);

export type DashboardBatchQueryPayload = {
  data: DashboardBatchSummary;
  errors: DashboardBatchSummaryErrors;
};

/**
 * Heute-kritische Widgets zuerst (Reservierungen, Team, Nachrichten, …).
 * Rest lädt in Phase 2 — Time-to-first-KPI ohne auf langsame Kacheln zu warten.
 */
export function partitionDashboardBatchWidgets(
  widgets: readonly DashboardBatchWidgetId[],
): {
  priority: DashboardBatchWidgetId[];
  deferred: DashboardBatchWidgetId[];
} {
  const requested = new Set(widgets);
  const priority: DashboardBatchWidgetId[] = [];
  const deferred: DashboardBatchWidgetId[] = [];

  for (const id of DASHBOARD_BATCH_WIDGET_IDS) {
    if (!requested.has(id)) continue;
    if (PRIORITY_SET.has(id)) priority.push(id);
    else deferred.push(id);
  }

  return { priority, deferred };
}

export function mergeDashboardBatchQueryData(
  base: DashboardBatchQueryPayload,
  patch: DashboardBatchQueryPayload,
): DashboardBatchQueryPayload {
  return {
    data: { ...base.data, ...patch.data },
    errors: { ...base.errors, ...patch.errors },
  };
}
