import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  Images,
  MessageCircle,
  Newspaper,
  Package,
  PartyPopper,
  Receipt,
  Star,
  Users,
  UtensilsCrossed,
} from "lucide-react";

/** Sidebar module ids (Dashboard stays fixed above this list). */
export const SIDEBAR_MODULE_IDS = [
  "menu",
  "inventory",
  "reservierungen",
  "events",
  "kontakte",
  "news",
  "bewertungen",
  "galerie",
  "buchfuehrung",
  "dokumente",
  "checklisten",
  "mitarbeiter",
] as const;

export type SidebarModuleId = (typeof SIDEBAR_MODULE_IDS)[number];

const SIDEBAR_MODULE_ID_SET = new Set<string>(SIDEBAR_MODULE_IDS);

export type SidebarModuleDefinition = {
  id: SidebarModuleId;
  label: string;
  tooltip: string;
  href: string;
  pathPrefix: string;
  icon: LucideIcon;
};

export const DEFAULT_SIDEBAR_MODULE_ORDER: SidebarModuleId[] = [
  ...SIDEBAR_MODULE_IDS,
];

export const SIDEBAR_MODULE_DEFINITIONS: readonly SidebarModuleDefinition[] = [
  {
    id: "menu",
    label: "Speisekarte",
    tooltip: "Speisekarte",
    href: "/dashboard/menu/uebersicht",
    pathPrefix: "/dashboard/menu",
    icon: UtensilsCrossed,
  },
  {
    id: "inventory",
    label: "Bestand",
    tooltip: "Bestand",
    href: "/dashboard/inventory/uebersicht",
    pathPrefix: "/dashboard/inventory",
    icon: Package,
  },
  {
    id: "reservierungen",
    label: "Reservierungen",
    tooltip: "Reservierungen",
    href: "/dashboard/reservierungen/uebersicht",
    pathPrefix: "/dashboard/reservierungen",
    icon: CalendarDays,
  },
  {
    id: "events",
    label: "Events",
    tooltip: "Events",
    href: "/dashboard/events",
    pathPrefix: "/dashboard/events",
    icon: PartyPopper,
  },
  {
    id: "kontakte",
    label: "Nachrichten",
    tooltip: "Nachrichten",
    href: "/dashboard/kontakte/nachrichten?platform=all",
    pathPrefix: "/dashboard/kontakte",
    icon: MessageCircle,
  },
  {
    id: "news",
    label: "News",
    tooltip: "News",
    href: "/dashboard/news/uebersicht",
    pathPrefix: "/dashboard/news",
    icon: Newspaper,
  },
  {
    id: "bewertungen",
    label: "Bewertungen",
    tooltip: "Bewertungen",
    href: "/dashboard/bewertungen/uebersicht",
    pathPrefix: "/dashboard/bewertungen",
    icon: Star,
  },
  {
    id: "galerie",
    label: "Galerie",
    tooltip: "Galerie",
    href: "/dashboard/galerie/uebersicht",
    pathPrefix: "/dashboard/galerie",
    icon: Images,
  },
  {
    id: "buchfuehrung",
    label: "Buchführung",
    tooltip: "Buchführung",
    href: "/dashboard/buchfuehrung/rechnungen",
    pathPrefix: "/dashboard/buchfuehrung",
    icon: Receipt,
  },
  {
    id: "dokumente",
    label: "Dokumente",
    tooltip: "Dokumente",
    href: "/dashboard/dokumente/uebersicht",
    pathPrefix: "/dashboard/dokumente",
    icon: FileText,
  },
  {
    id: "checklisten",
    label: "Checklisten",
    tooltip: "Checklisten",
    href: "/dashboard/checklisten",
    pathPrefix: "/dashboard/checklisten",
    icon: ClipboardCheck,
  },
  {
    id: "mitarbeiter",
    label: "Mitarbeiter",
    tooltip: "Mitarbeiter",
    href: "/dashboard/mitarbeiter/uebersicht",
    pathPrefix: "/dashboard/mitarbeiter",
    icon: Users,
  },
];

export const SIDEBAR_MODULE_BY_ID = new Map(
  SIDEBAR_MODULE_DEFINITIONS.map((def) => [def.id, def] as const),
);

export function isSidebarModuleId(value: string): value is SidebarModuleId {
  return SIDEBAR_MODULE_ID_SET.has(value);
}

export function normalizeSidebarModuleOrder(input: unknown): SidebarModuleId[] {
  if (!Array.isArray(input)) return [...DEFAULT_SIDEBAR_MODULE_ORDER];
  const seen = new Set<SidebarModuleId>();
  const out: SidebarModuleId[] = [];
  for (const x of input) {
    if (typeof x !== "string" || !isSidebarModuleId(x) || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  for (const id of DEFAULT_SIDEBAR_MODULE_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function reorderSidebarModuleOrder(
  order: SidebarModuleId[],
  dragId: SidebarModuleId,
  dropId: SidebarModuleId,
): SidebarModuleId[] {
  if (dragId === dropId) return order;
  const from = order.indexOf(dragId);
  const to = order.indexOf(dropId);
  if (from < 0 || to < 0) return order;
  const next = [...order];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}
