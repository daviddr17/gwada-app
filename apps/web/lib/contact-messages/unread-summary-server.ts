import "server-only";

import { inboxPreviewSnippet } from "@/lib/contact-messages/inbox-preview-snippet";
import { conversationNotificationPlatform } from "@/lib/contact-messages/conversation-notification-platform";
import {
  DASHBOARD_MESSAGES_UNREAD_LIMIT,
  dashboardMessageThreadHref,
  type MessagesUnreadSummary,
} from "@/lib/contact-messages/messages-unread-summary";
import {
  fetchUnifiedInboxConversationsForDashboard,
  fetchUnifiedInboxConversationsServer,
} from "@/lib/contact-messages/unified-inbox-server";
import {
  conversationExcludedFromSeparateMessageNotification,
} from "@/lib/notifications/reservation-guest-message-notification";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";

function sumUnread(list: ContactConversationPreview[]): number {
  return list.reduce((acc, c) => acc + (c.is_unread ? c.unread_count : 0), 0);
}

export async function fetchMessagesUnreadSummary(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    whatsappConnected: boolean;
    emailConnected: boolean;
    facebookConnected?: boolean;
    instagramConnected?: boolean;
    /** Dashboard-Widget: keine volle Inbox-Liste (schlanker). */
    includeInboxConversations?: boolean;
  },
): Promise<MessagesUnreadSummary> {
  const includeInbox = params.includeInboxConversations !== false;
  const conversations = includeInbox
    ? await fetchUnifiedInboxConversationsServer(admin, params)
    : await fetchUnifiedInboxConversationsForDashboard(admin, params);
  const notifyable = conversations.filter(
    (c) => !conversationExcludedFromSeparateMessageNotification(c),
  );
  const total_unread = sumUnread(notifyable);

  const unread = notifyable
    .filter((c) => c.is_unread && c.unread_count > 0)
    .slice(0, DASHBOARD_MESSAGES_UNREAD_LIMIT)
    .map((c) => ({
      contactId: c.contact_id,
      contactName: c.contact_name?.trim() || "Kontakt",
      preview: inboxPreviewSnippet(c.last_body, c.last_attachment_kind),
      lastAt: c.last_at,
      href: dashboardMessageThreadHref(c.contact_id),
      unreadCount: c.unread_count,
      platform: conversationNotificationPlatform(c),
    }));

  return {
    total_unread,
    unread,
    inboxConversations: includeInbox ? conversations : [],
  };
}

export async function isWhatsappConfigured(): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
  return Boolean(config);
}
