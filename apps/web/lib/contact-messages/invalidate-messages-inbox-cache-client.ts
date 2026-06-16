"use client";

import { deleteContactThreadCacheEntry } from "@/lib/contact-messages/contact-thread-cache";
import {
  clearUnifiedInboxCache,
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

  if (all || !contactId?.trim()) {
    clearUnifiedInboxCache(restaurantId);
  } else {
    patchUnifiedInboxCacheConversation(restaurantId, contactId, {
      is_unread: false,
      unread_count: 0,
      whatsapp_unread_count: 0,
      email_unread_count: 0,
    });
    deleteContactThreadCacheEntry(restaurantId, contactId);
  }

  dispatchDashboardMessagesRefresh();
}
