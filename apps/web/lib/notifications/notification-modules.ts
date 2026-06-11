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
  settingsPushLabel: string;
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
    settingsInAppLabel: "Ungelesene Nachrichten in der App",
    settingsPushLabel: "Neue Nachrichten",
  },
  reviews: {
    id: "reviews",
    label: "Bewertung",
    labelPlural: "Bewertungen",
    href: "/dashboard/bewertungen/uebersicht",
    icon: Star,
    settingsInAppLabel: "Neue Bewertungen in der App",
    settingsPushLabel: "Neue Bewertungen",
  },
  reservations: {
    id: "reservations",
    label: "Reservierung",
    labelPlural: "Reservierungen",
    href: "/dashboard/reservierungen/uebersicht",
    icon: CalendarDays,
    settingsInAppLabel: "Unbestätigte Reservierungen in der App",
    settingsPushLabel: "Unbestätigte Reservierungen",
  },
  changelog: {
    id: "changelog",
    label: "Changelog",
    labelPlural: "Changelog",
    href: "/changelog",
    icon: ScrollText,
    settingsInAppLabel: "Neue Changelog-Einträge in der App",
    settingsPushLabel: "Changelog-Updates",
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
