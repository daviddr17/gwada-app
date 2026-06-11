import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  MessageSquare,
  ScrollText,
  Star,
} from "lucide-react";

/** Erweiterbare Modul-IDs — neue Module hier registrieren. */
export const NOTIFICATION_MODULE_IDS = [
  "messages",
  "reviews",
  "reservations",
  "changelog",
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
  reservations: {
    id: "reservations",
    label: "Reservierung",
    labelPlural: "Reservierungen",
    href: "/dashboard/reservierungen/uebersicht",
    icon: CalendarDays,
    settingsInAppLabel: "Unbestätigte Reservierungen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei unbestätigten Reservierungen",
    settingsPushEmailLabel: "E-Mail bei unbestätigten Reservierungen",
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
};

export function isNotificationModuleId(
  value: string,
): value is NotificationModuleId {
  return (NOTIFICATION_MODULE_IDS as readonly string[]).includes(value);
}

export function notificationModulesInOrder(): NotificationModuleDefinition[] {
  return NOTIFICATION_MODULE_IDS.map((id) => NOTIFICATION_MODULES[id]);
}
