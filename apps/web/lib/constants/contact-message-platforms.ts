export const CONTACT_MESSAGE_PLATFORMS = [
  "gwada",
  "whatsapp",
  "email",
  "facebook",
  "instagram",
] as const;

export type ContactMessagePlatform = (typeof CONTACT_MESSAGE_PLATFORMS)[number];

export type ContactMessageDirection = "inbound" | "outbound";

export const CONTACT_MESSAGE_PLATFORM_LABELS: Record<
  ContactMessagePlatform,
  string
> = {
  gwada: "Gwada",
  whatsapp: "WhatsApp",
  email: "E-Mail",
  facebook: "Facebook",
  instagram: "Instagram",
};

/** Reihenfolge in der Nachrichten-UI (Gwada zuerst). */
export const CONTACT_MESSAGE_PLATFORM_ORDER: readonly ContactMessagePlatform[] =
  CONTACT_MESSAGE_PLATFORMS;

/** Posteingang-Chips: nur externe Kanäle (Gwada ist der gemeinsame Thread, kein Filter). */
export const INBOX_PLATFORM_FILTER_ORDER: readonly ContactMessagePlatform[] = [
  "whatsapp",
  "email",
  "facebook",
  "instagram",
];

export function isContactMessagePlatform(
  value: string,
): value is ContactMessagePlatform {
  return (CONTACT_MESSAGE_PLATFORMS as readonly string[]).includes(value);
}

/** Posteingang: alle Kanäle in einer Liste (Chips filtern nur die Ansicht). */
export const INBOX_FILTER_ALL = "all" as const;

export type InboxPlatformFilter =
  | typeof INBOX_FILTER_ALL
  | ContactMessagePlatform;

export const INBOX_FILTER_LABELS: Record<InboxPlatformFilter, string> = {
  all: "Alle",
  ...CONTACT_MESSAGE_PLATFORM_LABELS,
};

export function isInboxPlatformFilter(
  value: string,
): value is InboxPlatformFilter {
  return (
    value === INBOX_FILTER_ALL ||
    isContactMessagePlatform(value)
  );
}

export function parseInboxPlatformFilter(
  platformParam: string | null,
  contactParam: string | null,
): InboxPlatformFilter {
  const inferred = contactParam
    ? contactParam.startsWith("waha:")
      ? "whatsapp"
      : contactParam.startsWith("email:")
        ? "email"
        : null
    : null;
  if (inferred) return inferred;
  if (platformParam === "gwada") {
    return INBOX_FILTER_ALL;
  }
  if (platformParam && isInboxPlatformFilter(platformParam)) {
    return platformParam;
  }
  return INBOX_FILTER_ALL;
}
