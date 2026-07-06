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
  | "inventory";

/** Frühere Widget-IDs (Speisekarte), werden auf `menu` gemappt. */
const LEGACY_MENU_WIDGET_IDS = [
  "overviewStats",
  "activityChart",
  "categoryChart",
] as const;

export type DashboardWidgetPrefs = {
  visibility: Record<DashboardWidgetId, boolean>;
  order: DashboardWidgetId[];
  shortcuts: DashboardShortcutPrefs;
};

export const DASHBOARD_WIDGET_STORAGE_KEY = "gwada-dashboard-widgets";

export const DEFAULT_DASHBOARD_WIDGET_VISIBILITY: Record<
  DashboardWidgetId,
  boolean
> = {
  heute: true,
  menu: true,
  reservations: true,
  reviews: false,
  staff: true,
  weather: true,
  contacts: true,
  messages: true,
  integrations: true,
  inventory: true,
};

export const DASHBOARD_WIDGET_OPTIONS: readonly {
  id: DashboardWidgetId;
  label: string;
  description: string;
}[] = [
  {
    id: "heute",
    label: "Heute",
    description:
      "Tagesüberblick: Reservierungen, Team, Nachrichten und Hinweise auf einen Blick",
  },
  {
    id: "menu",
    label: "Speisekarte",
    description: "Gerichte, Kategorien, Preise und Top-Kategorie",
  },
  {
    id: "reservations",
    label: "Reservierungen",
    description:
      "Nächste Reservierungen, Unbestätigtes und Ø Personen in der Kalenderwoche",
  },
  {
    id: "reviews",
    label: "Bewertungen",
    description:
      "Neueste Bewertungen und Ø im Plattform-Vergleich (Gwada, Google, Facebook)",
  },
  {
    id: "staff",
    label: "Mitarbeiter",
    description:
      "Live-Schichten vom Display (Aktiv/Pause) und erfasste Arbeitszeit heute",
  },
  {
    id: "weather",
    label: "Wetter",
    description: "Aktuelles Wetter am Restaurantstandort",
  },
  {
    id: "contacts",
    label: "Kontakte",
    description: "Anzahl Kontakte, mit Reservierung und Firmenkontakte",
  },
  {
    id: "messages",
    label: "Nachrichten",
    description: "Ungelesene Chats auf Gwada und WhatsApp",
  },
  {
    id: "integrations",
    label: "Integrationen",
    description:
      "Freigeschaltete Kanäle (WhatsApp, E-Mail, Social) — verbunden in Farbe, offen ausgegraut",
  },
  {
    id: "inventory",
    label: "Bestand & Bestellung",
    description: "Zutaten, leerer Bestand und offene Bestellungen",
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
