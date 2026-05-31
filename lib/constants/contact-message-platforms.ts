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

export function isContactMessagePlatform(
  value: string,
): value is ContactMessagePlatform {
  return (CONTACT_MESSAGE_PLATFORMS as readonly string[]).includes(value);
}
