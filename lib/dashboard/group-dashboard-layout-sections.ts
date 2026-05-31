import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";

/** Jedes sichtbare Widget = ein Layout-Segment in Nutzerreihenfolge. */
export function groupDashboardLayoutSections(
  orderedVisible: DashboardWidgetId[],
): DashboardWidgetId[] {
  return [...orderedVisible];
}
