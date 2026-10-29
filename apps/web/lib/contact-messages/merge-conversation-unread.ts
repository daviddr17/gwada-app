import {
  computeConversationUnread,
  conversationReadLookupKey,
  conversationUnreadInput,
  type ConversationReadRow,
} from "@/lib/contact-messages/conversation-read-state";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { CommunalConversationReadMap } from "@/lib/supabase/contact-conversation-reads-db";
import { communalReadAtForConversation } from "@/lib/supabase/contact-conversation-reads-db";

export function mergeUnreadIntoConversations(
  conversations: ContactConversationPreview[],
  reads: Map<string, ConversationReadRow>,
  platform: ContactMessagePlatform,
  communalReads?: CommunalConversationReadMap,
): ContactConversationPreview[] {
  const personalReadOnly = platform === "email";
  return conversations.map((c) => {
    const read = reads.get(
      conversationReadLookupKey(c.contact_id, platform),
    );
    const communal_read_at =
      personalReadOnly || !communalReads
        ? null
        : communalReadAtForConversation(communalReads, c.contact_id, platform);
    const { unread_count, is_unread, unread_hint } = computeConversationUnread({
      read,
      conversation: conversationUnreadInput(c, platform),
      communal_read_at,
      personalReadOnly,
    });
    return {
      ...c,
      unread_count,
      is_unread,
      unread_hint,
    };
  });
}
