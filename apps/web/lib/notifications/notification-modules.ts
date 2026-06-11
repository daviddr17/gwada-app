import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  MessageSquare,
  Package,
  ScrollText,
  Star,
  Timer,
  TimerOff,
} from "lucide-react";

/** Erweiterbare Modul-IDs — neue Module hier registrieren. */
export const NOTIFICATION_MODULE_IDS = [
  "messages",
  "reviews",
  "changelog",
  "reservations_pending",
  "reservations_change_request",
  "reservations_cancellation",
  "staff_shift_start",
  "staff_shift_end",
  "inventory_low_stock",
] as const;

export type NotificationModuleId = (typeof NOTIFICATION_MODULE_IDS)[number];

export type NotificationModuleDefinition = {
  id: NotificationModuleId;
  label: string;
  labelPlural: string;
  href: string;
  icon: LucideIcon;
  settingsInAppLabel: string;
  settingsPushWhatsappLabel: string;
  settingsPushEmailLabel: string;
};

export const NOTIFICATION_MODULES: Record<
  NotificationModuleId,
  NotificationModuleDefinition
> = {
  messages: {
    id: "messages",
    label: "Nachricht",
    labelPlural: "Nachrichten",
    href: "/dashboard/kontakte/nachrichten?platform=all&read=unread",
    icon: MessageSquare,
    settingsInAppLabel: "Ungelesene Konversationen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei neuen Nachrichten",
    settingsPushEmailLabel: "E-Mail bei neuen Nachrichten",
  },
  reviews: {
    id: "reviews",
    label: "Bewertung",
    labelPlural: "Bewertungen",
    href: "/dashboard/bewertungen/uebersicht",
    icon: Star,
    settingsInAppLabel: "Neue Bewertungen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei neuen Bewertungen",
    settingsPushEmailLabel: "E-Mail bei neuen Bewertungen",
  },
  changelog: {
    id: "changelog",
    label: "Changelog",
    labelPlural: "Changelog",
    href: "/changelog",
    icon: ScrollText,
    settingsInAppLabel: "Neue Changelog-Einträge in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Changelog-Updates",
    settingsPushEmailLabel: "E-Mail bei Changelog-Updates",
  },
  reservations_pending: {
    id: "reservations_pending",
    label: "Unbestätigte Reservierung",
    labelPlural: "Unbestätigt",
    href: "/dashboard/reservierungen/uebersicht?unconfirmed=1",
    icon: CalendarDays,
    settingsInAppLabel: "Neue/unbestätigte Reservierungen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei unbestätigten Reservierungen",
    settingsPushEmailLabel: "E-Mail bei unbestätigten Reservierungen",
  },
  reservations_change_request: {
    id: "reservations_change_request",
    label: "Änderungsanfrage",
    labelPlural: "Änderungsanfragen",
    href: "/dashboard/reservierungen/uebersicht?unconfirmed=1",
    icon: CalendarClock,
    settingsInAppLabel: "Änderungsanfragen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Änderungsanfragen",
    settingsPushEmailLabel: "E-Mail bei Änderungsanfragen",
  },
  reservations_cancellation: {
    id: "reservations_cancellation",
    label: "Stornierung",
    labelPlural: "Stornierungen",
    href: "/dashboard/reservierungen/uebersicht",
    icon: CalendarX2,
    settingsInAppLabel: "Stornierungen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Stornierungen",
    settingsPushEmailLabel: "E-Mail bei Stornierungen",
  },
  staff_shift_start: {
    id: "staff_shift_start",
    label: "Schichtbeginn",
    labelPlural: "Schichtbeginn",
    href: "/dashboard/mitarbeiter/schichtplan",
    icon: Timer,
    settingsInAppLabel: "Bevorstehende Schichtbeginne in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Schichtbeginn",
    settingsPushEmailLabel: "E-Mail bei Schichtbeginn",
  },
  staff_shift_end: {
    id: "staff_shift_end",
    label: "Schichtende",
    labelPlural: "Schichtende",
    href: "/dashboard/mitarbeiter/schichtplan",
    icon: TimerOff,
    settingsInAppLabel: "Beendete Schichten in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Schichtende",
    settingsPushEmailLabel: "E-Mail bei Schichtende",
  },
  inventory_low_stock: {
    id: "inventory_low_stock",
    label: "Niedrigbestand",
    labelPlural: "Niedrigbestand",
    href: "/dashboard/inventory/uebersicht",
    icon: Package,
    settingsInAppLabel: "Niedrigbestand in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Niedrigbestand",
    settingsPushEmailLabel: "E-Mail bei Niedrigbestand",
  },
};

/** Legacy-ID aus früheren Versionen (Preferences-Migration). */
export const LEGACY_NOTIFICATION_MODULE_ALIASES: Record<string, NotificationModuleId[]> =
  {
    reservations: [
      "reservations_pending",
      "reservations_change_request",
      "reservations_cancellation",
    ],
  };

export function isNotificationModuleId(
  value: string,
): value is NotificationModuleId {
  return (NOTIFICATION_MODULE_IDS as readonly string[]).includes(value);
}

export function notificationModulesInOrder(): NotificationModuleDefinition[] {
  return NOTIFICATION_MODULE_IDS.map((id) => NOTIFICATION_MODULES[id]);
}
