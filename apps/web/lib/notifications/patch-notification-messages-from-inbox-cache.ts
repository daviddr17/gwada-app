"use client";

import { deriveMessagesUnreadSummaryFromConversations } from "@/lib/contact-messages/messages-unread-summary";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import type {
  NotificationSummary,
} from "@/lib/notifications/notification-types";

/** Nachrichten-Modul aus Inbox-Liste ableiten — gleiche Zähler wie /kontakte/nachrichten. */
export function notificationSummaryWithMessagesFromConversations(
  summary: NotificationSummary,
  conversations: ContactConversationPreview[],
): NotificationSummary {
  const derived = deriveMessagesUnreadSummaryFromConversations(conversations);
  const withoutMessages = summary.modules.filter((m) => m.id !== "messages");

  if (derived.total_unread <= 0) {
    const modules = withoutMessages;
    return {
      ...summary,
      modules,
      totalCount: modules.reduce((sum, m) => sum + m.count, 0),
    };
  }

  const messagesModule = {
    id: "messages" as const,
    count: derived.total_unread,
    label: NOTIFICATION_MODULES.messages.labelPlural,
    href: NOTIFICATION_MODULES.messages.href,
    items: derived.unread.map((row) => ({
      id: row.contactId,
      title: row.contactName,
      subtitle: row.preview,
      href: row.href,
      at: row.lastAt,
      meta: {
        contactId: row.contactId,
        platform: row.platform,
        ...(row.unreadHint ? { unreadHint: row.unreadHint } : {}),
      },
    })),
  };

  const modules = [...withoutMessages, messagesModule];
  return {
    ...summary,
    modules,
    totalCount: modules.reduce((sum, m) => sum + m.count, 0),
  };
}
