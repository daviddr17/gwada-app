import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

/** Gast-Nachricht bei neuer Reservierung — kein separates Nachrichten-Alert. */
export function conversationExcludedFromSeparateMessageNotification(
  conversation: ContactConversationPreview,
): boolean {
  return (
    conversation.last_direction === "inbound" &&
    Boolean(conversation.last_reservation_id) &&
    conversation.last_message_suppress_notifications === true
  );
}
