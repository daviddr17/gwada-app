import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";

/** Widgets, die über die Batch-Summary-API geladen werden (ohne Wetter). */
export const DASHBOARD_BATCH_WIDGET_IDS = [
  "menu",
  "reservations",
  "reviews",
  "staff",
  "contacts",
  "messages",
  "integrations",
  "inventory",
] as const satisfies readonly DashboardWidgetId[];

export type DashboardBatchWidgetId = (typeof DASHBOARD_BATCH_WIDGET_IDS)[number];

const BATCH_WIDGET_SET = new Set<string>(DASHBOARD_BATCH_WIDGET_IDS);

export function isDashboardBatchWidgetId(
  id: string,
): id is DashboardBatchWidgetId {
  return BATCH_WIDGET_SET.has(id);
}

export function parseDashboardBatchWidgetsParam(
  raw: string | null,
): DashboardBatchWidgetId[] {
  if (!raw?.trim()) return [...DASHBOARD_BATCH_WIDGET_IDS];
  const parsed = raw
    .split(",")
    .map((part) => part.trim())
    .filter(isDashboardBatchWidgetId);
  return parsed.length > 0 ? parsed : [...DASHBOARD_BATCH_WIDGET_IDS];
}

export function visibleDashboardBatchWidgets(
  visibility: Record<DashboardWidgetId, boolean>,
): DashboardBatchWidgetId[] {
  return DASHBOARD_BATCH_WIDGET_IDS.filter((id) => visibility[id]);
}
