export type DashboardWidgetId =
  | "overviewStats"
  | "weather"
  | "activityChart"
  | "categoryChart";

export type DashboardWidgetPrefs = {
  visibility: Record<DashboardWidgetId, boolean>;
  order: DashboardWidgetId[];
};

/** localStorage-Schlüssel für Dashboard-Widget-Sichtbarkeit */
export const DASHBOARD_WIDGET_STORAGE_KEY = "gwada-dashboard-widgets";

export const DEFAULT_DASHBOARD_WIDGET_VISIBILITY: Record<
  DashboardWidgetId,
  boolean
> = {
  overviewStats: true,
  weather: true,
  activityChart: true,
  categoryChart: true,
};

export const DASHBOARD_WIDGET_OPTIONS: readonly {
  id: DashboardWidgetId;
  label: string;
  description: string;
}[] = [
  {
    id: "overviewStats",
    label: "Kennzahlen",
    description: "Gerichte, Kategorien und durchschnittlicher Preis",
  },
  {
    id: "weather",
    label: "Wetter",
    description: "Aktuelles Wetter am Restaurantstandort",
  },
  {
    id: "activityChart",
    label: "Diagramm Aktivität",
    description: "Demo-Zeitreihe (Aufrufe)",
  },
  {
    id: "categoryChart",
    label: "Diagramm Kategorien",
    description: "Gerichte pro Kategorie",
  },
] as const;

/** Standard-Reihenfolge = Reihenfolge in `DASHBOARD_WIDGET_OPTIONS`. */
export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] =
  DASHBOARD_WIDGET_OPTIONS.map((o) => o.id);

const ORDER_SET = new Set<DashboardWidgetId>(DEFAULT_DASHBOARD_WIDGET_ORDER);

export function normalizeWidgetOrder(input: unknown): DashboardWidgetId[] {
  if (!Array.isArray(input)) return [...DEFAULT_DASHBOARD_WIDGET_ORDER];
  const seen = new Set<DashboardWidgetId>();
  const out: DashboardWidgetId[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    const id = x as DashboardWidgetId;
    if (!ORDER_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/** Liste neu sortieren: `dragId` wird vor `dropId` eingefügt (wie typische Listen-DnD). */
export function reorderDashboardWidgetOrder(
  order: DashboardWidgetId[],
  dragId: DashboardWidgetId,
  dropId: DashboardWidgetId,
): DashboardWidgetId[] {
  if (dragId === dropId) return order;
  const from = order.indexOf(dragId);
  const to = order.indexOf(dropId);
  if (from < 0 || to < 0) return order;
  const next = [...order];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}
