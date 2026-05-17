import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";

export type DashboardLayoutSection =
  | { kind: "overviewStats" }
  | { kind: "weather" }
  | { kind: "charts"; widgetIds: DashboardWidgetId[] };

function isChartWidget(id: DashboardWidgetId): boolean {
  return id === "activityChart" || id === "categoryChart";
}

/** Sichtbare Widgets in Nutzerreihenfolge → Layout-Segmente (benachbarte Diagramme eine Zeile). */
export function groupDashboardLayoutSections(
  orderedVisible: DashboardWidgetId[],
): DashboardLayoutSection[] {
  const sections: DashboardLayoutSection[] = [];
  const chartBuf: DashboardWidgetId[] = [];

  const flushCharts = () => {
    if (chartBuf.length === 0) return;
    sections.push({ kind: "charts", widgetIds: [...chartBuf] });
    chartBuf.length = 0;
  };

  for (const id of orderedVisible) {
    if (isChartWidget(id)) {
      chartBuf.push(id);
    } else {
      flushCharts();
      if (id === "overviewStats") sections.push({ kind: "overviewStats" });
      else if (id === "weather") sections.push({ kind: "weather" });
    }
  }
  flushCharts();
  return sections;
}
