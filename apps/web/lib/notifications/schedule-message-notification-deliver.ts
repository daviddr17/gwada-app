import "server-only";

import { findMessageNotificationEventId } from "@/lib/notifications/find-message-notification-event";
import { scheduleNotificationDeliverForEvent } from "@/lib/notifications/schedule-notification-deliver";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Nach ingest/emit: Push-Zustellung anstoßen (Event per reference_id, auch wenn DB-Trigger emit hat). */
export function scheduleDeliverForMessageNotificationReference(
  admin: SupabaseClient,
  restaurantId: string,
  referenceId: string,
): void {
  void findMessageNotificationEventId(admin, restaurantId, referenceId).then(
    (eventId) => {
      if (!eventId) return;
      scheduleNotificationDeliverForEvent(admin, eventId);
    },
  );
}
