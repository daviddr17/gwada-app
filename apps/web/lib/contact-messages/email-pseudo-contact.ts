import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";

export function isEmailPseudoContactId(contactId: string): boolean {
  return contactId.startsWith("email:");
}

export function emailAddressFromPseudoContactId(
  contactId: string,
): string | null {
  if (!isEmailPseudoContactId(contactId)) return null;
  return normalizeContactEmail(contactId.slice(6));
}
