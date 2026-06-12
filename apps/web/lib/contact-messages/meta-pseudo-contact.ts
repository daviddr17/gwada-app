import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";

const META_PREFIX = "meta:";

export function isMetaPseudoContactId(contactId: string): boolean {
  return contactId.startsWith(META_PREFIX);
}

export function metaPseudoContactId(
  platform: "facebook" | "instagram",
  senderId: string,
): string {
  return `${META_PREFIX}${platform}:${senderId.trim()}`;
}

export function parseMetaPseudoContactId(contactId: string): {
  platform: "facebook" | "instagram";
  senderId: string;
} | null {
  if (!isMetaPseudoContactId(contactId)) return null;
  const rest = contactId.slice(META_PREFIX.length);
  const colon = rest.indexOf(":");
  if (colon <= 0) return null;
  const platform = rest.slice(0, colon);
  const senderId = rest.slice(colon + 1).trim();
  if (
    (platform !== "facebook" && platform !== "instagram") ||
    !senderId
  ) {
    return null;
  }
  return { platform, senderId };
}

export function metaPlatformFromPseudoContactId(
  contactId: string,
): ContactMessagePlatform | null {
  const parsed = parseMetaPseudoContactId(contactId);
  return parsed?.platform ?? null;
}
