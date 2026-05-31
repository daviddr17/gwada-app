import {
  computeConversationUnread,
  conversationReadLookupKey,
  type ConversationReadRow,
} from "@/lib/contact-messages/conversation-read-state";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export function mergeUnreadIntoConversations(
  conversations: ContactConversationPreview[],
  reads: Map<string, ConversationReadRow>,
  platform: ContactMessagePlatform,
): ContactConversationPreview[] {
  return conversations.map((c) => {
    const read = reads.get(
      conversationReadLookupKey(c.contact_id, platform),
    );
    const { unread_count, is_unread } = computeConversationUnread({
      read,
      conversation: {
        last_at: c.last_at,
        last_direction: c.last_direction,
        inbound_count: c.inbound_since_preview ?? undefined,
        external_unread_count:
          platform === "whatsapp" || platform === "email"
            ? c.unread_count
            : null,
      },
    });
    return {
      ...c,
      unread_count,
      is_unread,
    };
  });
}
