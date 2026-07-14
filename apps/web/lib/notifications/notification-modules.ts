import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CirclePlay,
  CircleStop,
  FileSpreadsheet,
  FileText,
  FileSignature,
  MessageSquare,
  Package,
  Receipt,
  ScrollText,
  Star,
  Timer,
  TimerOff,
  TimerReset,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
} from "lucide-react";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

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
  "accounting_quotation",
  "accounting_invoice",
  "accounting_voucher",
  "staff_todo_completed",
  "staff_todo_deferred",
  "staff_contract_signed",
  "staff_display_time_request",
  "staff_invite_accepted",
  "staff_invite_declined",
  "staff_display_clock_in",
  "staff_display_clock_out",
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
    settingsInAppLabel: "Bevorstehende Schichtplan-Beginne in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Schichtplan-Beginn",
    settingsPushEmailLabel: "E-Mail bei Schichtplan-Beginn",
  },
  staff_shift_end: {
    id: "staff_shift_end",
    label: "Schichtende",
    labelPlural: "Schichtende",
    href: "/dashboard/mitarbeiter/schichtplan",
    icon: TimerOff,
    settingsInAppLabel: "Beendete Schichtplan-Schichten in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Schichtplan-Ende",
    settingsPushEmailLabel: "E-Mail bei Schichtplan-Ende",
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
  accounting_quotation: {
    id: "accounting_quotation",
    label: "Angebot",
    labelPlural: "Angebote",
    href: "/dashboard/buchfuehrung/angebote",
    icon: FileSpreadsheet,
    settingsInAppLabel: "Neue Angebote in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei neuen Angeboten",
    settingsPushEmailLabel: "E-Mail bei neuen Angeboten",
  },
  accounting_invoice: {
    id: "accounting_invoice",
    label: "Rechnung",
    labelPlural: "Rechnungen",
    href: "/dashboard/buchfuehrung/rechnungen",
    icon: FileText,
    settingsInAppLabel: "Neue Rechnungen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei neuen Rechnungen",
    settingsPushEmailLabel: "E-Mail bei neuen Rechnungen",
  },
  accounting_voucher: {
    id: "accounting_voucher",
    label: "Beleg",
    labelPlural: "Belege",
    href: "/dashboard/buchfuehrung/belege",
    icon: Receipt,
    settingsInAppLabel: "Neue Belege in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei neuen Belegen",
    settingsPushEmailLabel: "E-Mail bei neuen Belegen",
  },
  staff_todo_completed: {
    id: "staff_todo_completed",
    label: "ToDo erledigt",
    labelPlural: "ToDos erledigt",
    href: "/dashboard/checklisten",
    icon: CheckCircle2,
    settingsInAppLabel: "Erledigte ToDos in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei erledigten ToDos",
    settingsPushEmailLabel: "E-Mail bei erledigten ToDos",
  },
  staff_todo_deferred: {
    id: "staff_todo_deferred",
    label: "ToDo verschoben",
    labelPlural: "ToDos verschoben",
    href: "/dashboard/checklisten",
    icon: Clock,
    settingsInAppLabel: "Verschobene ToDos in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei verschobenen ToDos",
    settingsPushEmailLabel: "E-Mail bei verschobenen ToDos",
  },
  staff_contract_signed: {
    id: "staff_contract_signed",
    label: "Arbeitsvertrag",
    labelPlural: "Arbeitsverträge",
    href: APP_ROUTES.profile.documents,
    icon: FileSignature,
    settingsInAppLabel: "Neue/unterschriebene Verträge in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei neuen Verträgen",
    settingsPushEmailLabel: "E-Mail bei neuen Verträgen",
  },
  staff_display_time_request: {
    id: "staff_display_time_request",
    label: "Zeit nachtragen",
    labelPlural: "Zeit nachtragen",
    href: "/dashboard/mitarbeiter/uebersicht",
    icon: TimerReset,
    settingsInAppLabel: "Nachtragungs-Anfragen vom Display in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Nachtragungs-Anfragen",
    settingsPushEmailLabel: "E-Mail bei Nachtragungs-Anfragen",
  },
  staff_invite_accepted: {
    id: "staff_invite_accepted",
    label: "Einladung angenommen",
    labelPlural: "Einladungen angenommen",
    href: "/dashboard/mitarbeiter/uebersicht",
    icon: UserCheck,
    settingsInAppLabel: "Angenommene Einladungen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei angenommenen Einladungen",
    settingsPushEmailLabel: "E-Mail bei angenommenen Einladungen",
  },
  staff_invite_declined: {
    id: "staff_invite_declined",
    label: "Einladung abgelehnt",
    labelPlural: "Einladungen abgelehnt",
    href: "/dashboard/mitarbeiter/uebersicht",
    icon: UserX,
    settingsInAppLabel: "Abgelehnte Einladungen in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei abgelehnten Einladungen",
    settingsPushEmailLabel: "E-Mail bei abgelehnten Einladungen",
  },
  staff_display_clock_in: {
    id: "staff_display_clock_in",
    label: "Display-Schichtstart",
    labelPlural: "Display-Schichtstart",
    href: "/dashboard/mitarbeiter/uebersicht",
    icon: CirclePlay,
    settingsInAppLabel: "Display: Schicht gestartet in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Display-Schichtstart",
    settingsPushEmailLabel: "E-Mail bei Display-Schichtstart",
  },
  staff_display_clock_out: {
    id: "staff_display_clock_out",
    label: "Display-Schichtende",
    labelPlural: "Display-Schichtende",
    href: "/dashboard/mitarbeiter/uebersicht",
    icon: CircleStop,
    settingsInAppLabel: "Display: Schicht beendet in der Glocke",
    settingsPushWhatsappLabel: "WhatsApp bei Display-Schichtende",
    settingsPushEmailLabel: "E-Mail bei Display-Schichtende",
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
