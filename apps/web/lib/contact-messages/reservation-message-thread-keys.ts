import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { wahaPseudoContactIdFromChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";

/** Thread-Keys (Kontakt-UUID oder Pseudo-ID) für Gast-E-Mail/Telefon einer Reservierung. */
export function reservationGuestThreadKeys(params: {
  guestEmail?: string | null;
  guestPhone?: string | null;
  linkedContactId?: string | null;
}): string[] {
  const keys = new Set<string>();

  const contactId = params.linkedContactId?.trim();
  if (contactId && isLinkedContactId(contactId)) {
    keys.add(contactId);
  }

  const emailNorm = normalizeContactEmail(params.guestEmail);
  if (emailNorm) {
    keys.add(`email:${emailNorm}`);
  }

  const chatId = guestPhoneToWhatsAppChatId(params.guestPhone);
  if (chatId) {
    keys.add(wahaPseudoContactIdFromChatId(chatId));
  }

  return [...keys];
}

export function mergeMessageRowsById(
  target: Map<string, Record<string, unknown>>,
  rows: readonly Record<string, unknown>[],
): void {
  for (const row of rows) {
    const id = row.id as string;
    if (!target.has(id)) {
      target.set(id, row);
    }
  }
}
