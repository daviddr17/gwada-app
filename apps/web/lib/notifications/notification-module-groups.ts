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
    description: "Schichtbeginn und Schichtende als eigene Hinweise.",
    moduleIds: ["staff_shift_start", "staff_shift_end"],
  },
  {
    id: "inventory",
    title: "Bestand",
    moduleIds: ["inventory_low_stock"],
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
