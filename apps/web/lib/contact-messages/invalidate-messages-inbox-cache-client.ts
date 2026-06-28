"use client";

import { deleteContactThreadCacheEntry } from "@/lib/contact-messages/contact-thread-cache";
import {
  markAllUnifiedInboxCacheRead,
  patchUnifiedInboxCacheConversation,
} from "@/lib/contact-messages/unified-inbox-cache";
import { dispatchDashboardMessagesRefresh } from "@/lib/dashboard/dashboard-live-events";

/** Nach serverseitigem Gelesen (Glocke/Thread): Inbox-Cache zurücksetzen und Views anstoßen. */
export function invalidateMessagesInboxAfterMarkRead(params: {
  restaurantId: string;
  contactId?: string | null;
  /** „Alle Nachrichten gelesen“ — voller Inbox-Cache weg. */
  all?: boolean;
}): void {
  const { restaurantId, contactId, all } = params;
  const markAll = Boolean(all || !contactId?.trim());

  if (markAll) {
    markAllUnifiedInboxCacheRead(restaurantId);
  } else {
    patchUnifiedInboxCacheConversation(restaurantId, contactId!, {
      is_unread: false,
      unread_count: 0,
      whatsapp_unread_count: 0,
      email_unread_count: 0,
      unread_hint: null,
    });
    deleteContactThreadCacheEntry(restaurantId, contactId!);
  }

  dispatchDashboardMessagesRefresh({
    restaurantId,
    contactId: markAll ? undefined : contactId ?? undefined,
    all: markAll,
  });
}
