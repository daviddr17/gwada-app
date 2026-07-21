import "server-only";

import { resolveConversationThreadRef } from "@/lib/contact-messages/conversation-thread-key";
import { sanitizeConversationLabelForStorage } from "@/lib/contact-messages/waha-chat-label";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Spiegelt eine ausgehende Restaurant-E-Mail in den Nachrichten-Thread
 * (Kontakt-UUID oder email:-Pseudo-Thread).
 */
export async function mirrorOutboundEmailToContactMessages(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    guestEmail: string;
    body: string;
    contactId?: string | null;
    reservationId?: string | null;
    sentBy?: string | null;
    deliveryStatus?: string;
    /** Optionaler Betreff — wird der Body-Zeile vorangestellt, wenn gesetzt. */
    subject?: string | null;
  },
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { ok: false, error: "invalid_restaurant" };
  }

  const emailNorm = normalizeContactEmail(params.guestEmail);
  if (!emailNorm?.includes("@")) {
    return { ok: false, error: "no_email" };
  }

  let contactId =
    params.contactId && isUuidRestaurantId(params.contactId)
      ? params.contactId
      : null;

  if (!contactId) {
    const { data: phoneRow } = await admin
      .from("contact_emails")
      .select("contact_id")
      .eq("restaurant_id", params.restaurantId)
      .eq("email_normalized", emailNorm)
      .limit(1)
      .maybeSingle();
    contactId = (phoneRow as { contact_id: string } | null)?.contact_id ?? null;
  }

  const threadKey = contactId ?? `email:${emailNorm}`;
  const thread = resolveConversationThreadRef(threadKey);
  if (!thread.contactId && !thread.conversationKey) {
    return { ok: false, error: "invalid_thread" };
  }

  const subject = params.subject?.trim();
  const bodyRaw = params.body.trim() || " ";
  const body =
    subject && !bodyRaw.toLowerCase().startsWith(subject.toLowerCase())
      ? `${subject}\n\n${bodyRaw}`
      : bodyRaw;

  const { data, error } = await admin
    .from("contact_messages")
    .insert({
      restaurant_id: params.restaurantId,
      contact_id: thread.contactId,
      conversation_key: thread.conversationKey,
      conversation_label: thread.conversationKey
        ? sanitizeConversationLabelForStorage(emailNorm)
        : null,
      platform: "email",
      direction: "outbound",
      body,
      reservation_id: params.reservationId ?? null,
      sent_by: params.sentBy ?? null,
      delivery_status: params.deliveryStatus ?? "sent",
      suppress_notifications: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  return { ok: true, messageId: (data as { id: string }).id };
}
