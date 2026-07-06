import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";
import {
  DASHBOARD_BATCH_WIDGET_IDS,
  type DashboardBatchWidgetId,
} from "@/lib/dashboard/dashboard-batch-widgets";
import {
  hasDashboardWidgetAccess,
  type DashboardWidgetAccessOptions,
} from "@/lib/permissions/dashboard-widget-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

/** Batch-Daten für das Heute-Widget (auch wenn Einzel-Widgets ausgeblendet sind). */
export const DASHBOARD_HEUTE_BATCH_WIDGET_IDS = [
  "reservations",
  "staff",
  "messages",
  "inventory",
  "reviews",
] as const satisfies readonly DashboardBatchWidgetId[];

export function resolveDashboardBatchWidgetIds(
  visibility: Record<DashboardWidgetId, boolean>,
  has: (key: RestaurantPermissionKey) => boolean,
  accessOptions: DashboardWidgetAccessOptions,
): DashboardBatchWidgetId[] {
  const set = new Set<DashboardBatchWidgetId>();

  for (const id of DASHBOARD_BATCH_WIDGET_IDS) {
    if (visibility[id] && hasDashboardWidgetAccess(has, id, accessOptions)) {
      set.add(id);
    }
  }

  if (visibility.heute) {
    for (const id of DASHBOARD_HEUTE_BATCH_WIDGET_IDS) {
      if (hasDashboardWidgetAccess(has, id, accessOptions)) {
        set.add(id);
      }
    }
  }

  return DASHBOARD_BATCH_WIDGET_IDS.filter((id) => set.has(id));
}
