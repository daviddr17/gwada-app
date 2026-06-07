import "server-only";

import { insertContactMessageIfNew } from "@/lib/contacts/contact-inbound-message-insert";
import { fetchWahaThreadMessages } from "@/lib/contact-messages/waha-inbox-service";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import type { SupabaseClient } from "@supabase/supabase-js";

/** WAHA-Verlauf in DB spiegeln (Gwada-Thread + E-Mail-Icon über `platform: whatsapp`). */
export async function syncContactWhatsappInbound(
  admin: SupabaseClient,
  params: { restaurantId: string; contactId: string },
): Promise<{ imported: number; error: string | null }> {
  const phone = await resolveWhatsappPhoneForContact(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    reservationId: null,
  });
  const chatId = phone ? guestPhoneToWhatsAppChatId(phone) : null;
  if (!chatId) return { imported: 0, error: "no_whatsapp_chat" };

  const { data: messages, error } = await fetchWahaThreadMessages(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    chatIdOverride: chatId,
  });

  if (error) return { imported: 0, error };

  const externalIds = messages
    .map((m) => m.id)
    .filter((id) => id.startsWith("waha:"));

  if (externalIds.length === 0) return { imported: 0, error: null };

  const { data: existing } = await admin
    .from("contact_messages")
    .select("external_source_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .in("external_source_id", externalIds);

  const known = new Set(
    (existing ?? []).map(
      (r) => (r as { external_source_id: string }).external_source_id,
    ),
  );

  let imported = 0;
  for (const m of messages) {
    if (!m.id.startsWith("waha:") || known.has(m.id)) continue;
    const body =
      m.body.trim() ||
      (m.attachments?.length ? "Anhang" : "");
    if (!body) continue;

    const inserted = await insertContactMessageIfNew(admin, {
      restaurantId: params.restaurantId,
      contactId: params.contactId,
      platform: "whatsapp",
      direction: m.direction,
      body,
      externalSourceId: m.id,
      createdAt: m.created_at,
      deliveryStatus: m.delivery_status,
      reservationId: m.reservation_id,
    });
    if (inserted) imported += 1;
  }

  return { imported, error: null };
}
