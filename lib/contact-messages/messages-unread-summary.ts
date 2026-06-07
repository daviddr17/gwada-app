import { inboxPreviewSnippet } from "@/lib/contact-messages/inbox-preview-snippet";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export const DASHBOARD_MESSAGES_UNREAD_LIMIT = 4;

export type DashboardMessageUnreadRow = {
  contactId: string;
  contactName: string;
  preview: string;
  lastAt: string;
  href: string;
  unreadCount: number;
};

export type MessagesUnreadSummary = {
  total_unread: number;
  unread: DashboardMessageUnreadRow[];
  /** Vollständige Posteingang-Liste für sofortige Anzeige auf /kontakte/nachrichten. */
  inboxConversations: ContactConversationPreview[];
};

export function dashboardMessageThreadHref(contactId: string): string {
  return `/dashboard/kontakte/nachrichten?platform=all&contact=${encodeURIComponent(contactId)}`;
}

export function deriveMessagesUnreadSummaryFromConversations(
  conversations: ContactConversationPreview[],
): MessagesUnreadSummary {
  const total_unread = conversations.reduce(
    (acc, c) => acc + (c.is_unread ? c.unread_count : 0),
    0,
  );

  const unread = conversations
    .filter((c) => c.is_unread && c.unread_count > 0)
    .slice(0, DASHBOARD_MESSAGES_UNREAD_LIMIT)
    .map((c) => ({
      contactId: c.contact_id,
      contactName: c.contact_name?.trim() || "Kontakt",
      preview: inboxPreviewSnippet(c.last_body, c.last_attachment_kind),
      lastAt: c.last_at,
      href: dashboardMessageThreadHref(c.contact_id),
      unreadCount: c.unread_count,
    }));

  return {
    total_unread,
    unread,
    inboxConversations: conversations,
  };
}
