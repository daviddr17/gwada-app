import "server-only";

import type { ContactMessageDirection } from "@/lib/constants/contact-message-platforms";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";
import { resolveConversationThreadRef } from "@/lib/contact-messages/conversation-thread-key";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactInboundInsertRow = {
  restaurantId: string;
  /** Verknüpfter Kontakt oder Pseudo-Thread-Schlüssel (waha:/email:/meta:). */
  contactId: string;
  platform: ContactMessagePlatform;
  direction: ContactMessageDirection;
  body: string;
  externalSourceId: string;
  createdAt?: string;
  reservationId?: string | null;
  deliveryStatus?: string;
  attachmentKind?: ContactMessageAttachmentKind | null;
  conversationLabel?: string | null;
  /** Kein notification_events / Push (Backfill, Connect-Historie). */
  suppressNotifications?: boolean;
  /** IMAP \\Seen für email-imap:-Spiegel (Unread aus DB). */
  externalSeen?: boolean;
};

export type ContactInboundInsertResult = {
  inserted: boolean;
  messageId?: string;
};

export async function insertContactMessageIfNew(
  admin: SupabaseClient,
  row: ContactInboundInsertRow,
): Promise<ContactInboundInsertResult> {
  if (!isUuidRestaurantId(row.restaurantId)) {
    return { inserted: false };
  }

  const thread = resolveConversationThreadRef(row.contactId);
  if (!thread.contactId && !thread.conversationKey) {
    return { inserted: false };
  }

  const { data: existing } = await admin
    .from("contact_messages")
    .select("id")
    .eq("restaurant_id", row.restaurantId)
    .eq("external_source_id", row.externalSourceId)
    .maybeSingle();

  if (existing) {
    return {
      inserted: false,
      messageId: (existing as { id: string }).id,
    };
  }

  const { data, error } = await admin
    .from("contact_messages")
    .insert({
      restaurant_id: row.restaurantId,
      contact_id: thread.contactId,
      conversation_key: thread.conversationKey,
      conversation_label: thread.conversationKey
        ? (row.conversationLabel?.trim() || null)
        : null,
      platform: row.platform,
      direction: row.direction,
      body: row.body,
      reservation_id: row.reservationId ?? null,
      sent_by: null,
      delivery_status: row.deliveryStatus ?? "delivered",
      external_source_id: row.externalSourceId,
      suppress_notifications: row.suppressNotifications === true,
      ...(row.externalSeen !== undefined
        ? { external_seen: row.externalSeen }
        : {}),
      ...(row.createdAt ? { created_at: row.createdAt } : {}),
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[contact-inbox] insert", error.message);
    return { inserted: false };
  }

  return {
    inserted: true,
    messageId: (data as { id: string }).id,
  };
}
