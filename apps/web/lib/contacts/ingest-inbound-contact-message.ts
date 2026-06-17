import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  insertContactMessageIfNew,
  type ContactInboundInsertRow,
} from "@/lib/contacts/contact-inbound-message-insert";
import {
  emitMessageNotificationEventForInboundContactMessage,
} from "@/lib/notifications/emit-message-notification-event";
import { scheduleDeliverForMessageNotificationReference } from "@/lib/notifications/schedule-message-notification-deliver";

/**
 * Einheitlicher Einstieg für eingehende Kanal-Nachrichten:
 * DB-Spiegel + notification_events (idempotent, Trigger als Backup).
 */
export async function ingestInboundContactMessage(
  admin: SupabaseClient,
  row: ContactInboundInsertRow,
): Promise<{ imported: boolean; messageId?: string }> {
  const { inserted, messageId } = await insertContactMessageIfNew(admin, row);

  if (inserted && messageId && row.direction === "inbound") {
    await emitMessageNotificationEventForInboundContactMessage(admin, {
      restaurantId: row.restaurantId,
      messageId,
      contactId: row.contactId,
      platform: row.platform,
      body: row.body,
      createdAt: row.createdAt,
      attachmentKind: row.attachmentKind,
    });
    scheduleDeliverForMessageNotificationReference(
      admin,
      row.restaurantId,
      messageId,
    );
  }

  return { imported: inserted, messageId };
}
