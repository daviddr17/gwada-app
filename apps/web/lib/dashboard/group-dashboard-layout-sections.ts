import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";

export type DashboardLayoutSection = {
  id: DashboardWidgetId;
  /** Volle Breite ab lg (Heute-Briefing). */
  span: 1 | 2;
};

export type DashboardMasonryRun =
  | { type: "full"; items: DashboardLayoutSection[] }
  | { type: "columns"; items: DashboardLayoutSection[] };

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

/**
 * Volle Breite (Heute) nicht ins Zweispalter-Grid packen — eigene Zeile darüber,
 * damit Reservierungen/Wetter in Zeile 1 links/rechts auf einer Linie starten.
 */
export function groupDashboardMasonryRuns(
  sections: DashboardLayoutSection[],
): DashboardMasonryRun[] {
  const runs: DashboardMasonryRun[] = [];
  for (const section of sections) {
    const type = section.span === 2 ? "full" : "columns";
    const last = runs[runs.length - 1];
    if (last && last.type === type) {
      last.items.push(section);
    } else {
      runs.push({ type, items: [section] });
    }
  }
  return runs;
}
