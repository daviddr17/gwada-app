import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

/** Kanal-Icon in Glocke/Dashboard — bevorzugt den Kanal mit Ungelesen, nicht „gwada“. */
export function conversationNotificationPlatform(
  c: ContactConversationPreview,
): ContactMessagePlatform {
  if ((c.email_unread_count ?? 0) > 0) return "email";
  if ((c.whatsapp_unread_count ?? 0) > 0) return "whatsapp";

  if (c.platform !== "gwada") return c.platform;

  const inbound = c.last_inbound_platform;
  if (inbound && inbound !== "gwada") return inbound;

  const last = c.last_message_platform;
  if (last && last !== "gwada") return last;

  return inbound ?? last ?? "gwada";
}
