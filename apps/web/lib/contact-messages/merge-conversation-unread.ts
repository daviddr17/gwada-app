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
      conversation:
        platform === "gwada"
          ? { last_at: c.last_at, last_direction: c.last_direction }
          : {
              last_at: c.last_at,
              last_direction: c.last_direction,
              external_unread_count: c.unread_count,
            },
    });
    return {
      ...c,
      unread_count,
      is_unread,
    };
  });
}
