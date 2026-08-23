import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";

export function isEmailPseudoContactId(
  contactId: string | null | undefined,
): boolean {
  return typeof contactId === "string" && contactId.startsWith("email:");
}

export function emailAddressFromPseudoContactId(
  contactId: string | null | undefined,
): string | null {
  if (!isEmailPseudoContactId(contactId) || !contactId) return null;
  return normalizeContactEmail(contactId.slice(6));
}
