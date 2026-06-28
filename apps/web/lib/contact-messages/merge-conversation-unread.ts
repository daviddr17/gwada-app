import {
  computeConversationUnread,
  conversationReadLookupKey,
  conversationUnreadInput,
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
    const { unread_count, is_unread, unread_hint } = computeConversationUnread({
      read,
      conversation: conversationUnreadInput(c, platform),
    });
    return {
      ...c,
      unread_count,
      is_unread,
      unread_hint,
    };
  });
}
