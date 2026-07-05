"use client";

import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type { DashboardBatchSummary } from "@/lib/dashboard/load-dashboard-batch-summary-server";
import {
  DASHBOARD_WIDGET_LIVE_ENDPOINTS,
  type DashboardWidgetLiveFetchId,
} from "@/lib/dashboard/dashboard-widget-live-config";
import { fetchDashboardSummaryClient } from "@/lib/dashboard/fetch-dashboard-summary-client";

export async function fetchDashboardWidgetSummaryClient<
  W extends DashboardWidgetLiveFetchId,
>(widget: W, restaurantId: string): Promise<DashboardBatchSummary[W] | null> {
  const path = DASHBOARD_WIDGET_LIVE_ENDPOINTS[widget];
  const { data, error } = await fetchDashboardSummaryClient<
    DashboardBatchSummary[W]
  >(path, restaurantId);
  if (error || !data) return null;
  return data;
}

export function isDashboardWidgetLiveFetchId(
  widget: DashboardBatchWidgetId,
): widget is DashboardWidgetLiveFetchId {
  return widget in DASHBOARD_WIDGET_LIVE_ENDPOINTS;
}
