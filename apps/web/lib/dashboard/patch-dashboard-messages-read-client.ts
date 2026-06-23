import { deriveMessagesUnreadSummaryFromConversations } from "@/lib/contact-messages/messages-unread-summary";
import type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export function patchConversationsReadState(
  conversations: ContactConversationPreview[],
  params: { contactId?: string | null; all?: boolean },
): ContactConversationPreview[] {
  if (params.all) {
    return conversations.map((c) => ({
      ...c,
      is_unread: false,
      unread_count: 0,
      whatsapp_unread_count: 0,
      email_unread_count: 0,
    }));
  }

  const contactId = params.contactId?.trim();
  if (!contactId) return conversations;

  return conversations.map((c) =>
    c.contact_id === contactId
      ? {
          ...c,
          is_unread: false,
          unread_count: 0,
          whatsapp_unread_count: 0,
          email_unread_count: 0,
        }
      : c,
  );
}

export function patchMessagesUnreadSummary(
  summary: MessagesUnreadSummary,
  params: { contactId?: string | null; all?: boolean },
): MessagesUnreadSummary {
  const inboxConversations = patchConversationsReadState(
    summary.inboxConversations,
    params,
  );
  return deriveMessagesUnreadSummaryFromConversations(inboxConversations);
}
