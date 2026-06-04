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
  return `/kontakte/nachrichten?platform=all&contact=${encodeURIComponent(contactId)}`;
}
