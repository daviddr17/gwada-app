import "server-only";

import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { buildMessagePushPreview } from "@/lib/notifications/message-push-preview";
import { resolveMessageNotificationSender } from "@/lib/notifications/message-notification-sender";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Push-Event für Nachrichten (wenn kein contact_messages-Trigger greift, z. B. unverknüpfter WAHA-Chat). */
export async function emitMessageNotificationEventIfNew(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    referenceId: string;
    payload: Record<string, unknown>;
  },
): Promise<{ emitted: boolean; eventId: string | null }> {
  const { data: existing } = await admin
    .from("notification_events")
    .select("id")
    .eq("module", "messages")
    .eq("reference_id", params.referenceId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (existing) {
    const id = (existing as { id: string }).id;
    return { emitted: false, eventId: id };
  }

  const { data, error } = await admin
    .from("notification_events")
    .insert({
      restaurant_id: params.restaurantId,
      module: "messages",
      reference_id: params.referenceId,
      payload: params.payload,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[notification] emit messages event", error.message);
    return { emitted: false, eventId: null };
  }

  const id = (data as { id: string }).id;
  return { emitted: true, eventId: id };
}

/** Nach INSERT in contact_messages — gleiche reference_id wie DB-Trigger (message id). */
export async function emitMessageNotificationEventForInboundContactMessage(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    messageId: string;
    contactId: string;
    platform: ContactMessagePlatform;
    body: string;
    createdAt?: string;
    attachmentKind?: ContactMessageAttachmentKind | null;
  },
): Promise<{ emitted: boolean; eventId: string | null }> {
  const sender = await resolveMessageNotificationSender(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    platform: params.platform,
  });
  const preview = buildMessagePushPreview({
    body: params.body,
    attachmentKind: params.attachmentKind,
    senderName: sender.contactName,
  });

  const payload: Record<string, unknown> = {
    contactId: params.contactId,
    contactName: sender.contactName,
    preview,
    platform: params.platform,
    messageCreatedAt: params.createdAt ?? new Date().toISOString(),
  };
  if (sender.senderEmail) payload.senderEmail = sender.senderEmail;
  if (sender.senderPhone) payload.senderPhone = sender.senderPhone;

  return emitMessageNotificationEventIfNew(admin, {
    restaurantId: params.restaurantId,
    referenceId: params.messageId,
    payload,
  });
}
