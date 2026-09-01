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
    moduleIds: ["inventory_low_stock", "inventory_po_delivery_due"],
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
