import {
  NOTIFICATION_MODULES,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";

export type NotificationSettingsGroup = {
  id: string;
  title: string;
  description?: string;
  moduleIds: NotificationModuleId[];
};

export const NOTIFICATION_SETTINGS_GROUPS: NotificationSettingsGroup[] = [
  {
    id: "general",
    title: "Allgemein",
    moduleIds: ["messages", "messages_follow_up", "reviews", "changelog"],
  },
  {
    id: "reservations",
    title: "Reservierungen",
    description: "Neue, Änderungsanfragen und Stornierungen getrennt steuerbar.",
    moduleIds: [
      "reservations_pending",
      "reservations_change_request",
      "reservations_cancellation",
    ],
  },
  {
    id: "events",
    title: "Events",
    description: "Anfragen für private Veranstaltungen.",
    moduleIds: ["events_inquiry"],
  },
  {
    id: "staff",
    title: "Mitarbeiter",
    description: "Schichten, Aufgaben und Team-Chat.",
    moduleIds: [
      "staff_shift_start",
      "staff_shift_end",
      "staff_todo_completed",
      "staff_todo_deferred",
      "personal_reminder",
      "staff_messages",
      "staff_contract_signed",
      "staff_document_assigned",
      "staff_display_time_request",
      "staff_invite_accepted",
      "staff_invite_declined",
      "staff_display_clock_in",
      "staff_display_clock_out",
      "staff_permissions_granted",
    ],
  },
  {
    id: "inventory",
    title: "Bestand",
    description:
      "Niedrigbestand, fällige Lieferungen, aufgegebene und abgeschlossene Bestellungen.",
    moduleIds: [
      "inventory_low_stock",
      "inventory_po_delivery_due",
      "inventory_po_ordered",
      "inventory_po_closed",
    ],
  },
  {
    id: "accounting",
    title: "Buchführung",
    description: "Neue Angebote, Rechnungen und Belege getrennt steuerbar.",
    moduleIds: [
      "accounting_quotation",
      "accounting_invoice",
      "accounting_voucher",
    ],
  },
  {
    id: "digests",
    title: "Zusammenfassungen",
    description:
      "Optional. Täglich 8 Uhr Vorschau und 21 Uhr Rückblick, montags die Woche, sonntags der Wochenrückblick — Restaurantzeit. Kosten sind voraussichtlich.",
    moduleIds: [
      "digest_daily_preview",
      "digest_daily_review",
      "digest_weekly_preview",
      "digest_weekly_review",
    ],
  },
];

export function notificationModulesForSettingsGroup(
  groupId: string,
): NotificationModuleId[] {
  return (
    NOTIFICATION_SETTINGS_GROUPS.find((g) => g.id === groupId)?.moduleIds ?? []
  );
}

export function notificationModuleSettingsLabel(
  moduleId: NotificationModuleId,
): string {
  return NOTIFICATION_MODULES[moduleId].label;
}
