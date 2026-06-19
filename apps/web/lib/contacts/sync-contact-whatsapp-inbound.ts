import "server-only";

import { resolveConversationThreadRef } from "@/lib/contact-messages/conversation-thread-key";
import { fetchWahaThreadMessages } from "@/lib/contact-messages/waha-inbox-service";
import {
  whatsappMirrorBodyFromContactRow,
} from "@/lib/contact-messages/whatsapp-mirror-preview";
import {
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { ingestInboundContactMessage } from "@/lib/contacts/ingest-inbound-contact-message";
import { insertContactMessageIfNew } from "@/lib/contacts/contact-inbound-message-insert";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import type { SupabaseClient } from "@supabase/supabase-js";

async function mirrorWahaThreadToDb(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    threadKey: string;
    chatIdOverride?: string | null;
    conversationLabel?: string | null;
    /** Nur neueste N Nachrichten (Session-Warmup). */
    maxMessages?: number;
    /** Kein notification_events / Push (Session-Warmup). */
    silent?: boolean;
  },
): Promise<{ imported: number; error: string | null }> {
  const thread = resolveConversationThreadRef(params.threadKey);
  if (!thread.contactId && !thread.conversationKey) {
    return { imported: 0, error: "invalid_thread" };
  }

  const { data: messages, error } = await fetchWahaThreadMessages(admin, {
    restaurantId: params.restaurantId,
    contactId: params.threadKey,
    chatIdOverride: params.chatIdOverride ?? undefined,
    limit: params.maxMessages ? Math.max(params.maxMessages, 5) : undefined,
  });

  if (error) return { imported: 0, error };

  const toMirror =
    params.maxMessages != null && params.maxMessages > 0
      ? messages.slice(-params.maxMessages)
      : messages;

  const externalIds = toMirror
    .map((m) => m.id)
    .filter((id) => id.startsWith("waha:"));

  if (externalIds.length === 0) return { imported: 0, error: null };

  let existingQuery = admin
    .from("contact_messages")
    .select("external_source_id, body")
    .eq("restaurant_id", params.restaurantId)
    .in("external_source_id", externalIds);

  if (thread.contactId) {
    existingQuery = existingQuery.eq("contact_id", thread.contactId);
  } else {
    existingQuery = existingQuery.eq("conversation_key", thread.conversationKey!);
  }

  const { data: existing } = await existingQuery;

  const known = new Map<string, string>();
  for (const row of existing ?? []) {
    const r = row as { external_source_id: string; body: string };
    known.set(r.external_source_id, r.body ?? "");
  }

  let imported = 0;
  for (const m of toMirror) {
    if (!m.id.startsWith("waha:")) continue;

    const mirrorBody = whatsappMirrorBodyFromContactRow(m);
    if (!mirrorBody) continue;

    if (known.has(m.id)) {
      const currentBody = known.get(m.id) ?? "";
      if (mirrorBody && mirrorBody !== currentBody) {
        let updateQuery = admin
          .from("contact_messages")
          .update({ body: mirrorBody })
          .eq("restaurant_id", params.restaurantId)
          .eq("external_source_id", m.id);
        if (thread.contactId) {
          updateQuery = updateQuery.eq("contact_id", thread.contactId);
        } else {
          updateQuery = updateQuery.eq("conversation_key", thread.conversationKey!);
        }
        await updateQuery;
      }
      continue;
    }

    if (params.silent) {
      const inserted = await insertContactMessageIfNew(admin, {
        restaurantId: params.restaurantId,
        contactId: params.threadKey,
        platform: "whatsapp",
        direction: m.direction,
        body: mirrorBody,
        externalSourceId: m.id,
        createdAt: m.created_at,
        deliveryStatus: m.delivery_status,
        reservationId: m.reservation_id,
        conversationLabel: params.conversationLabel,
        suppressNotifications: true,
      });
      if (inserted.inserted) imported += 1;
      continue;
    }

    const result = await ingestInboundContactMessage(admin, {
      restaurantId: params.restaurantId,
      contactId: params.threadKey,
      platform: "whatsapp",
      direction: m.direction,
      body: mirrorBody,
      externalSourceId: m.id,
      createdAt: m.created_at,
      deliveryStatus: m.delivery_status,
      reservationId: m.reservation_id,
      conversationLabel: params.conversationLabel,
    });
    if (result.imported) imported += 1;
  }

  return { imported, error: null };
}

/** WAHA-Verlauf in DB spiegeln (verknüpfter Kontakt). */
export async function syncContactWhatsappInbound(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    maxMessages?: number;
    silent?: boolean;
  },
): Promise<{ imported: number; error: string | null }> {
  const phone = await resolveWhatsappPhoneForContact(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    reservationId: null,
  });
  const chatId = phone ? guestPhoneToWhatsAppChatId(phone) : null;
  if (!chatId) return { imported: 0, error: "no_whatsapp_chat" };

  return mirrorWahaThreadToDb(admin, {
    restaurantId: params.restaurantId,
    threadKey: params.contactId,
    chatIdOverride: chatId,
    maxMessages: params.maxMessages,
    silent: params.silent,
  });
}

/** WAHA-Verlauf für unverknüpften Pseudo-Chat in DB spiegeln. */
export async function syncPseudoWhatsappThread(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    conversationKey: string;
    maxMessages?: number;
    conversationLabel?: string | null;
    silent?: boolean;
  },
): Promise<{ imported: number; error: string | null }> {
  if (!isWahaPseudoContactId(params.conversationKey)) {
    return { imported: 0, error: "invalid_waha_contact" };
  }
  const chatId = wahaChatIdFromPseudoContactId(params.conversationKey);
  if (!chatId) return { imported: 0, error: "invalid_waha_contact" };

  return mirrorWahaThreadToDb(admin, {
    restaurantId: params.restaurantId,
    threadKey: params.conversationKey,
    chatIdOverride: chatId,
    maxMessages: params.maxMessages,
    conversationLabel: params.conversationLabel,
    silent: params.silent,
  });
}
