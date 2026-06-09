import type { LucideIcon } from "lucide-react";
import {
  CalendarPlus,
  Clock,
  Contact,
  FileText,
  Package,
  Star,
  UserPlus,
  UtensilsCrossed,
  CalendarRange,
  LayoutTemplate,
} from "lucide-react";

export const DASHBOARD_FAB_MAX_SHORTCUTS = 5;

export const DASHBOARD_SHORTCUT_IDS = [
  "reservation",
  "menu_dish",
  "inventory_ingredient",
  "contact",
  "document",
  "staff_member",
  "staff_shift",
  "staff_work_entry",
  "shift_template",
  "review_invite",
] as const;

export type DashboardShortcutId = (typeof DASHBOARD_SHORTCUT_IDS)[number];

const SHORTCUT_ID_SET = new Set<string>(DASHBOARD_SHORTCUT_IDS);

export type DashboardShortcutPrefs = {
  order: DashboardShortcutId[];
  visibility: Record<DashboardShortcutId, boolean>;
};

export type DashboardShortcutDefinition = {
  id: DashboardShortcutId;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
};

function localDayParam(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Ziel-URL inkl. Query zum direkten Öffnen des Anlege-Dialogs. */
export function dashboardShortcutHref(id: DashboardShortcutId): string {
  const today = localDayParam();
  switch (id) {
    case "reservation":
      return `/dashboard/reservierungen/uebersicht?new=1&day=${today}`;
    case "menu_dish":
      return `/dashboard/menu/uebersicht?new=1`;
    case "inventory_ingredient":
      return `/dashboard/inventory/uebersicht?new=1`;
    case "contact":
      return `/dashboard/kontakte/uebersicht?new=1`;
    case "document":
      return `/dashboard/dokumente/uebersicht?new=1`;
    case "staff_member":
      return `/dashboard/mitarbeiter/uebersicht?new=1`;
    case "staff_shift":
      return `/dashboard/mitarbeiter/schichtplan?new=1`;
    case "staff_work_entry":
      return `/dashboard/mitarbeiter/arbeitszeiten?new=1`;
    case "shift_template":
      return `/dashboard/mitarbeiter/schichtplan?new=template`;
    case "review_invite":
      return `/dashboard/bewertungen/uebersicht?new=invite`;
    default:
      return "/dashboard";
  }
}

export const DASHBOARD_SHORTCUT_OPTIONS: readonly DashboardShortcutDefinition[] =
  [
    {
      id: "reservation",
      label: "Neue Reservierung",
      description: "Reservierung für heute anlegen",
      icon: CalendarPlus,
      href: dashboardShortcutHref("reservation"),
    },
    {
      id: "menu_dish",
      label: "Neues Gericht",
      description: "Gericht in der Speisekarte anlegen",
      icon: UtensilsCrossed,
      href: dashboardShortcutHref("menu_dish"),
    },
    {
      id: "inventory_ingredient",
      label: "Neue Zutat",
      description: "Zutat im Bestand anlegen",
      icon: Package,
      href: dashboardShortcutHref("inventory_ingredient"),
    },
    {
      id: "contact",
      label: "Neuer Kontakt",
      description: "Kontakt in Gwada anlegen",
      icon: Contact,
      href: dashboardShortcutHref("contact"),
    },
    {
      id: "document",
      label: "Neues Dokument",
      description: "Dokument hochladen",
      icon: FileText,
      href: dashboardShortcutHref("document"),
    },
    {
      id: "staff_member",
      label: "Neuer Mitarbeiter",
      description: "Mitarbeiter im Team anlegen",
      icon: UserPlus,
      href: dashboardShortcutHref("staff_member"),
    },
    {
      id: "staff_shift",
      label: "Neue Schicht",
      description: "Schicht im Dienstplan anlegen",
      icon: CalendarRange,
      href: dashboardShortcutHref("staff_shift"),
    },
    {
      id: "staff_work_entry",
      label: "Neue Arbeitszeit",
      description: "Arbeitszeit für Mitarbeiter erfassen",
      icon: Clock,
      href: dashboardShortcutHref("staff_work_entry"),
    },
    {
      id: "shift_template",
      label: "Schichtvorlage",
      description: "Neue Vorlage im Schichtplan",
      icon: LayoutTemplate,
      href: dashboardShortcutHref("shift_template"),
    },
    {
      id: "review_invite",
      label: "Bewertungslink",
      description: "Gwada-Bewertungslink erstellen",
      icon: Star,
      href: dashboardShortcutHref("review_invite"),
    },
  ] as const;

export const DEFAULT_DASHBOARD_SHORTCUT_VISIBILITY: Record<
  DashboardShortcutId,
  boolean
> = {
  reservation: true,
  menu_dish: true,
  inventory_ingredient: true,
  contact: true,
  document: true,
  staff_member: true,
  staff_shift: true,
  staff_work_entry: true,
  shift_template: false,
  review_invite: false,
};

export const DEFAULT_DASHBOARD_SHORTCUT_ORDER: DashboardShortcutId[] =
  DASHBOARD_SHORTCUT_OPTIONS.map((o) => o.id);

export function canonicalDashboardShortcutId(
  raw: string,
): DashboardShortcutId | null {
  return SHORTCUT_ID_SET.has(raw) ? (raw as DashboardShortcutId) : null;
}

export function mergeDashboardShortcutVisibility(
  partial: Partial<Record<DashboardShortcutId, boolean>>,
): Record<DashboardShortcutId, boolean> {
  return { ...DEFAULT_DASHBOARD_SHORTCUT_VISIBILITY, ...partial };
}

export function normalizeShortcutOrder(input: unknown): DashboardShortcutId[] {
  if (!Array.isArray(input)) return [...DEFAULT_DASHBOARD_SHORTCUT_ORDER];
  const seen = new Set<DashboardShortcutId>();
  const out: DashboardShortcutId[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    const id = canonicalDashboardShortcutId(x);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of DEFAULT_DASHBOARD_SHORTCUT_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function shortcutVisibilityPatchFromStored(
  visRaw: Record<string, unknown>,
): Partial<Record<DashboardShortcutId, boolean>> {
  const patch: Partial<Record<DashboardShortcutId, boolean>> = {};
  for (const id of DASHBOARD_SHORTCUT_IDS) {
    if (typeof visRaw[id] === "boolean") {
      patch[id] = visRaw[id];
    }
  }
  return patch;
}

export function reorderDashboardShortcutOrder(
  order: DashboardShortcutId[],
  dragId: DashboardShortcutId,
  dropId: DashboardShortcutId,
): DashboardShortcutId[] {
  if (dragId === dropId) return order;
  const from = order.indexOf(dragId);
  const to = order.indexOf(dropId);
  if (from < 0 || to < 0) return order;
  const next = [...order];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export function defaultDashboardShortcutPrefs(): DashboardShortcutPrefs {
  return {
    order: [...DEFAULT_DASHBOARD_SHORTCUT_ORDER],
    visibility: { ...DEFAULT_DASHBOARD_SHORTCUT_VISIBILITY },
  };
}

/** Bis zu 5 sichtbare Shortcuts in Reihenfolge für das FAB-Menü. */
export function resolveDashboardFabShortcuts(
  prefs: DashboardShortcutPrefs,
): DashboardShortcutDefinition[] {
  const byId = new Map(DASHBOARD_SHORTCUT_OPTIONS.map((o) => [o.id, o]));
  const out: DashboardShortcutDefinition[] = [];
  for (const id of prefs.order) {
    if (!prefs.visibility[id]) continue;
    const def = byId.get(id);
    if (!def) continue;
    out.push(def);
    if (out.length >= DASHBOARD_FAB_MAX_SHORTCUTS) break;
  }
  return out;
}
