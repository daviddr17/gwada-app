import {
  defaultDashboardShortcutPrefs,
  type DashboardShortcutPrefs,
} from "@/lib/constants/dashboard-shortcuts";

export type DashboardWidgetId =
  | "heute"
  | "menu"
  | "reservations"
  | "reviews"
  | "staff"
  | "weather"
  | "contacts"
  | "messages"
  | "integrations"
  | "inventory"
  | "pos"
  | "events"
  | "news"
  | "insights"
  | "gallery"
  | "accounting"
  | "documents"
  | "checklists";

/** Frühere Widget-IDs (Speisekarte), werden auf `menu` gemappt. */
const LEGACY_MENU_WIDGET_IDS = [
  "overviewStats",
  "activityChart",
  "categoryChart",
] as const;

/** Früheres Kalender-Widget → jetzt Header-Overlay, aus Prefs entfernen. */
const LEGACY_REMOVED_WIDGET_IDS = ["calendar"] as const;

export type DashboardWidgetPrefs = {
  visibility: Record<DashboardWidgetId, boolean>;
  order: DashboardWidgetId[];
  shortcuts: DashboardShortcutPrefs;
};

export const DASHBOARD_WIDGET_STORAGE_KEY = "gwada-dashboard-widgets";

/**
 * Schlankes Standard-Set — Rest über „Anordnen“ zuschaltbar.
 * Effektive Sichtbarkeit zusätzlich: Rolle ∩ Restaurant-Abo
 * (`hasDashboardWidgetAccess`). Wetter nur bei Plattform-Freigabe.
 */
export const DEFAULT_DASHBOARD_WIDGET_VISIBILITY: Record<
  DashboardWidgetId,
  boolean
> = {
  heute: true,
  reservations: true,
  staff: true,
  messages: false,
  weather: true,
  menu: false,
  reviews: false,
  contacts: false,
  integrations: false,
  inventory: false,
  pos: false,
  events: false,
  news: false,
  insights: false,
  gallery: false,
  accounting: false,
  documents: false,
  checklists: false,
};

export const DASHBOARD_WIDGET_OPTIONS: readonly {
  id: DashboardWidgetId;
  label: string;
  description: string;
}[] = [
  {
    id: "heute",
    label: "Heute",
    description: "Was heute zählt — unbestätigt, Team, Nachrichten",
  },
  {
    id: "reservations",
    label: "Reservierungen",
    description: "Unbestätigtes und heutige Termine",
  },
  {
    id: "staff",
    label: "Mitarbeiter",
    description: "Wer ist da — Aktiv, Pause, Stunden",
  },
  {
    id: "messages",
    label: "Nachrichten",
    description: "Ungelesene Chats",
  },
  {
    id: "weather",
    label: "Wetter",
    description: "Wetter am Standort",
  },
  {
    id: "menu",
    label: "Speisekarte",
    description: "Gerichte und Kategorien",
  },
  {
    id: "reviews",
    label: "Bewertungen",
    description: "Neueste Bewertungen",
  },
  {
    id: "contacts",
    label: "Kontakte",
    description: "Kontakte gesamt",
  },
  {
    id: "integrations",
    label: "Integrationen",
    description: "Verbundene Kanäle",
  },
  {
    id: "inventory",
    label: "Bestand",
    description: "Leere Bestände und Bestellungen",
  },
  {
    id: "pos",
    label: "POS",
    description: "Umsatz und offene Tische",
  },
  {
    id: "events",
    label: "Events",
    description: "Geplante Events",
  },
  {
    id: "news",
    label: "News",
    description: "Beiträge und Planung",
  },
  {
    id: "insights",
    label: "Insights",
    description: "Kennzahlen im Überblick",
  },
  {
    id: "gallery",
    label: "Galerie",
    description: "Medien und Speicher",
  },
  {
    id: "accounting",
    label: "Buchführung",
    description: "Rechnungen und Belege",
  },
  {
    id: "documents",
    label: "Dokumente",
    description: "Dokumente und Speicher",
  },
  {
    id: "checklists",
    label: "Aufgaben",
    description: "Persönlich, Team und Protokoll",

  },
] as const;

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] =
  DASHBOARD_WIDGET_OPTIONS.map((o) => o.id);

const ORDER_SET = new Set<DashboardWidgetId>(DEFAULT_DASHBOARD_WIDGET_ORDER);

/** Alte IDs → aktuelle Widget-ID. */
export function canonicalDashboardWidgetId(
  raw: string,
): DashboardWidgetId | null {
  if ((LEGACY_MENU_WIDGET_IDS as readonly string[]).includes(raw)) {
    return "menu";
  }
  if ((LEGACY_REMOVED_WIDGET_IDS as readonly string[]).includes(raw)) {
    return null;
  }
  if (ORDER_SET.has(raw as DashboardWidgetId)) {
    return raw as DashboardWidgetId;
  }
  return null;
}

/** Sichtbarkeit aus gespeichertem JSON (inkl. Legacy-Speisekarten-Widgets). */
export function visibilityPatchFromStored(
  visRaw: Record<string, unknown>,
): Partial<Record<DashboardWidgetId, boolean>> {
  const patch: Partial<Record<DashboardWidgetId, boolean>> = {};
  for (const id of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (typeof visRaw[id] === "boolean") {
      patch[id] = visRaw[id] as boolean;
    }
  }
  if (patch.menu === undefined) {
    const legacyVals = LEGACY_MENU_WIDGET_IDS.map((k) => visRaw[k]).filter(
      (v) => typeof v === "boolean",
    ) as boolean[];
    if (legacyVals.some((v) => v === true)) patch.menu = true;
    else if (
      legacyVals.length === LEGACY_MENU_WIDGET_IDS.length &&
      legacyVals.every((v) => v === false)
    ) {
      patch.menu = false;
    }
  }
  return patch;
}

export function mergeDashboardWidgetVisibility(
  partial: Partial<Record<DashboardWidgetId, boolean>>,
): Record<DashboardWidgetId, boolean> {
  return { ...DEFAULT_DASHBOARD_WIDGET_VISIBILITY, ...partial };
}

export function normalizeWidgetOrder(input: unknown): DashboardWidgetId[] {
  if (!Array.isArray(input)) return [...DEFAULT_DASHBOARD_WIDGET_ORDER];
  const seen = new Set<DashboardWidgetId>();
  const out: DashboardWidgetId[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    const id = canonicalDashboardWidgetId(x);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function defaultDashboardWidgetPrefs(): DashboardWidgetPrefs {
  return {
    visibility: { ...DEFAULT_DASHBOARD_WIDGET_VISIBILITY },
    order: [...DEFAULT_DASHBOARD_WIDGET_ORDER],
    shortcuts: defaultDashboardShortcutPrefs(),
  };
}

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
