"use client";

import { clearUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { dispatchDashboardMessagesRefresh } from "@/lib/dashboard/dashboard-live-events";

/** Nach Kanal-Verbindung: Cache leeren, DB-Historie-Import abwarten, neu laden. */
export function invalidateInboxAfterChannelConnect(restaurantId: string): void {
  clearUnifiedInboxCache(restaurantId);
  window.setTimeout(() => {
    dispatchDashboardMessagesRefresh();
  }, 4_000);
}
