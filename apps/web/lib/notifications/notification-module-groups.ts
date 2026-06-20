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
    moduleIds: ["messages", "reviews", "changelog"],
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
    id: "staff",
    title: "Mitarbeiter",
    description: "Schichten und ToDo-Listen als eigene Hinweise.",
    moduleIds: [
      "staff_shift_start",
      "staff_shift_end",
      "staff_todo_completed",
      "staff_todo_deferred",
    ],
  },
  {
    id: "inventory",
    title: "Bestand",
    moduleIds: ["inventory_low_stock"],
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
