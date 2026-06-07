import type { WhatsappMessageKind } from "@/lib/whatsapp/reservation-whatsapp-message-config";

export type ReservationNotificationKind = WhatsappMessageKind;

/** Status-Farbe für den Balken vor dem Eintrag (globale `reservation_statuses`). */
export const NOTIFICATION_KIND_STATUS_CODE: Partial<
  Record<ReservationNotificationKind, string>
> = {
  received: "pending",
  confirmed: "confirmed",
  cancelled: "cancelled",
  declined: "declined",
  no_show: "no_show",
  reminder: "confirmed",
  thanks: "completed",
};

export type NotificationMessageFieldMeta = {
  kind: ReservationNotificationKind;
  title: string;
  description: string;
  /** Anzeige im Titel, z. B. „Offen“ */
  statusLabel?: string;
};

export const NOTIFICATION_MESSAGE_FIELDS: readonly NotificationMessageFieldMeta[] =
  [
    {
      kind: "received",
      title: "Eingang",
      statusLabel: "Offen",
      description: "Bei neuer Reservierung mit Status Offen",
    },
    {
      kind: "confirmed",
      title: "Bestätigung",
      statusLabel: "Bestätigt",
      description: "Wenn Status auf Bestätigt wechselt oder direkt bestätigt angelegt",
    },
    {
      kind: "cancelled",
      title: "Storniert",
      statusLabel: "Storniert",
      description: "Wenn Status auf Storniert wechselt",
    },
    {
      kind: "declined",
      title: "Abgesagt",
      statusLabel: "Abgesagt",
      description: "Wenn Status auf Abgesagt wechselt",
    },
    {
      kind: "no_show",
      title: "Nicht erschienen",
      statusLabel: "Nicht erschienen",
      description: "Wenn Status auf Nicht erschienen wechselt",
    },
    {
      kind: "reminder",
      title: "Erinnerung",
      description: "Vor dem Termin (geplant)",
    },
    {
      kind: "thanks",
      title: "Danke & Bewertung",
      description: "Nach dem Besuch (geplant)",
    },
  ] as const;

export const TIMED_NOTIFICATION_KINDS = ["reminder", "thanks"] as const;
