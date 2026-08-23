import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Package,
  Plus,
  VolumeX,
  Volume2,
  Users,
} from "lucide-react";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export type OpsCommandId =
  | "nav_reservations"
  | "nav_messages"
  | "nav_staff"
  | "nav_inventory"
  | "nav_checklists"
  | "nav_dashboard"
  | "action_new_reservation"
  | "action_calendar"
  | "toggle_quiet";

export type OpsCommand = {
  id: OpsCommandId;
  label: string;
  hint?: string;
  href?: string;
  icon: LucideIcon;
  /** Client-only action key (quiet toggle, calendar open via custom event). */
  action?: "toggle_quiet" | "open_calendar";
};

export const OPS_COMMANDS: readonly OpsCommand[] = [
  {
    id: "nav_dashboard",
    label: "Dashboard",
    hint: "Heute & Überblick",
    href: APP_ROUTES.dashboard,
    icon: Activity,
  },
  {
    id: "nav_reservations",
    label: "Reservierungen",
    hint: "Tischplan & Anfragen",
    href: "/dashboard/reservierungen",
    icon: CalendarDays,
  },
  {
    id: "action_new_reservation",
    label: "Neue Reservierung",
    hint: "Direkt anlegen",
    href: "/dashboard/reservierungen?neu=1",
    icon: Plus,
  },
  {
    id: "nav_messages",
    label: "Nachrichten",
    hint: "Inbox",
    href: "/dashboard/kontakte/nachrichten?platform=all",
    icon: MessageCircle,
  },
  {
    id: "nav_staff",
    label: "Mitarbeiter",
    hint: "Team & Schichten",
    href: "/dashboard/mitarbeiter/uebersicht",
    icon: Users,
  },
  {
    id: "nav_inventory",
    label: "Bestand",
    hint: "Lager & Bestellungen",
    href: "/dashboard/inventory/uebersicht",
    icon: Package,
  },
  {
    id: "nav_checklists",
    label: "Checklisten",
    hint: "To-dos",
    href: "/dashboard/checklisten",
    icon: ClipboardList,
  },
  {
    id: "action_calendar",
    label: "Kalender öffnen",
    hint: "⇧⌘C",
    icon: CalendarDays,
    action: "open_calendar",
  },
  {
    id: "toggle_quiet",
    label: "Ruhe-Modus umschalten",
    hint: "Live-Toasts an/aus",
    icon: VolumeX,
    action: "toggle_quiet",
  },
] as const;

export function opsCommandIconForQuiet(quiet: boolean): LucideIcon {
  return quiet ? Volume2 : VolumeX;
}

export function filterOpsCommands(query: string): OpsCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...OPS_COMMANDS];
  return OPS_COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      (c.hint?.toLowerCase().includes(q) ?? false),
  );
}

/** Dashboard öffnet Kalender-Overlay. */
export const GWADA_OPS_OPEN_CALENDAR_EVENT = "gwada:ops-open-calendar";

export function dispatchOpsOpenCalendar() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GWADA_OPS_OPEN_CALENDAR_EVENT));
}
