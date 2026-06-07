import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

const EMAIL_IMAP_PREFIX = "email-imap:";
const WAHA_PREFIX = "waha:";

/** Kanal-Icon im Gwada-Thread (auch wenn ältere Zeilen fälschlich `platform: gwada` haben). */
export function messageDisplayPlatform(
  message: ContactMessageRow,
): ContactMessagePlatform {
  const ext = message.external_source_id?.trim() ?? "";
  if (ext.startsWith(EMAIL_IMAP_PREFIX)) return "email";
  if (ext.startsWith(WAHA_PREFIX) || message.waha_message_id) return "whatsapp";
  return message.platform;
}

export function displayPlatformsForMessage(
  message: ContactMessageRow,
): ContactMessagePlatform[] {
  return [messageDisplayPlatform(message)];
}
