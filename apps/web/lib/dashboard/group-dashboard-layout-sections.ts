import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";

export type DashboardLayoutSection = {
  id: DashboardWidgetId;
  /** Volle Breite ab lg (Heute-Briefing). */
  span: 1 | 2;
};

const FULL_WIDTH_WIDGETS = new Set<DashboardWidgetId>(["heute"]);

/** Sichtbare Widgets in Nutzerreihenfolge inkl. Layout-Span. */
export function groupDashboardLayoutSections(
  orderedVisible: DashboardWidgetId[],
): DashboardLayoutSection[] {
  return orderedVisible.map((id) => ({
    id,
    span: FULL_WIDTH_WIDGETS.has(id) ? 2 : 1,
  }));
}
