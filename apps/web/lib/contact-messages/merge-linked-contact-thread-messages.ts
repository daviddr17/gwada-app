import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import {
  mergeDbMessagesWithWahaThread,
} from "@/lib/contact-messages/whatsapp-mirror-preview";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

const EMAIL_IMAP_EXTERNAL_PREFIX = "email-imap:";

function imapUidFromDbEmailMessage(message: ContactMessageRow): string | null {
  const ext = message.external_source_id?.trim();
  if (!ext?.startsWith(EMAIL_IMAP_EXTERNAL_PREFIX)) return null;
  return ext.slice(EMAIL_IMAP_EXTERNAL_PREFIX.length);
}

function imapUidFromImapMessage(message: ContactMessageRow): string | null {
  if (!message.id.startsWith("imap:")) return null;
  return message.id.slice(5);
}

function sortByCreatedAt(messages: ContactMessageRow[]): ContactMessageRow[] {
  return [...messages].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

function finalizeWhatsappThreadMessages(
  dbMessages: ContactMessageRow[],
  wahaMessages: ContactMessageRow[] | null | undefined,
): ContactMessageRow[] {
  return sortByCreatedAt(mergeDbMessagesWithWahaThread(dbMessages, wahaMessages));
}

/**
 * Verknüpfte Kontakte: Gwada/WhatsApp aus der DB, E-Mails mit HTML aus IMAP.
 * Ohne IMAP bleibt der DB-Stand (Plain-Text).
 */
export function mergeLinkedContactThreadMessages(params: {
  dbMessages: ContactMessageRow[];
  imapEmailMessages: ContactMessageRow[] | null;
  wahaMessages?: ContactMessageRow[] | null;
}): ContactMessageRow[] {
  const { dbMessages, imapEmailMessages, wahaMessages } = params;

  if (!imapEmailMessages?.length) {
    return finalizeWhatsappThreadMessages(dbMessages, wahaMessages);
  }

  const nonEmail = dbMessages.filter(
    (m) => messageDisplayPlatform(m) !== "email",
  );

  const reservationByImapUid = new Map<string, string>();
  for (const message of dbMessages) {
    const uid = imapUidFromDbEmailMessage(message);
    if (uid && message.reservation_id) {
      reservationByImapUid.set(uid, message.reservation_id);
    }
  }

  const emailFromImap = imapEmailMessages.map((message) => {
    const uid = imapUidFromImapMessage(message);
    const reservationId = uid ? reservationByImapUid.get(uid) : undefined;
    if (!reservationId) return message;
    return { ...message, reservation_id: reservationId };
  });

  const imapOutboundKeys = new Set(
    emailFromImap
      .filter((m) => m.direction === "outbound")
      .map((m) => `${m.created_at}|${m.body.trim()}`),
  );

  const dbOnlyEmailOutbound = dbMessages.filter((message) => {
    if (messageDisplayPlatform(message) !== "email") return false;
    if (message.direction !== "outbound") return false;
    const key = `${message.created_at}|${message.body.trim()}`;
    return !imapOutboundKeys.has(key);
  });

  return finalizeWhatsappThreadMessages(
    [...nonEmail, ...emailFromImap, ...dbOnlyEmailOutbound],
    wahaMessages,
  );
}
