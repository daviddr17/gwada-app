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
import { sanitizeConversationLabelForStorage } from "@/lib/contact-messages/waha-chat-label";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** WAHA ack ≥ 3 = am WhatsApp-Kanal gelesen (Spiegel für Soft-Unread). */
function wahaInboundExternalSeen(
  message: Pick<ContactMessageRow, "direction" | "waha_ack">,
): boolean | undefined {
  if (message.direction !== "inbound") return undefined;
  const ack = message.waha_ack;
  if (typeof ack === "number" && Number.isFinite(ack) && ack >= 3) return true;
  return false;
}

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
    /**
     * Historien-Import (Connect): Kanal als gelesen behandeln.
     * Verhindert Sidebar „Nachrichten (88)“ aus Altverlauf ohne WAHA-ack.
     * Cron-Catch-up setzt das nicht — dort gilt weiter ack/external_seen.
     */
    markChannelSeen?: boolean;
    /** Nur Nachrichten ab diesem Zeitpunkt (Cron-Catch-up, kein Altverlauf). */
    minCreatedAtMs?: number;
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

  let toMirror =
    params.maxMessages != null && params.maxMessages > 0
      ? messages.slice(-params.maxMessages)
      : messages;

  if (
    params.minCreatedAtMs != null &&
    Number.isFinite(params.minCreatedAtMs) &&
    params.minCreatedAtMs > 0
  ) {
    const minMs = params.minCreatedAtMs;
    toMirror = toMirror.filter((m) => {
      const t = new Date(m.created_at).getTime();
      return Number.isFinite(t) && t >= minMs;
    });
  }

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

    const externalSeen = params.markChannelSeen
      ? true
      : wahaInboundExternalSeen(m);

    if (known.has(m.id)) {
      const currentBody = known.get(m.id) ?? "";
      if (
        (mirrorBody && mirrorBody !== currentBody) ||
        externalSeen !== undefined
      ) {
        let updateQuery = admin
          .from("contact_messages")
          .update({
            ...(mirrorBody && mirrorBody !== currentBody
              ? { body: mirrorBody }
              : {}),
            ...(externalSeen !== undefined
              ? { external_seen: externalSeen }
              : {}),
          })
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
        conversationLabel: sanitizeConversationLabelForStorage(
          params.conversationLabel,
        ),
        suppressNotifications: true,
        externalSeen,
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
      conversationLabel: sanitizeConversationLabelForStorage(
        params.conversationLabel,
      ),
      externalSeen,
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
    markChannelSeen?: boolean;
    minCreatedAtMs?: number;
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
    markChannelSeen: params.markChannelSeen,
    minCreatedAtMs: params.minCreatedAtMs,
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
    markChannelSeen?: boolean;
    minCreatedAtMs?: number;
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
    conversationLabel: sanitizeConversationLabelForStorage(
      params.conversationLabel,
    ),
    silent: params.silent,
    markChannelSeen: params.markChannelSeen,
    minCreatedAtMs: params.minCreatedAtMs,
  });
}
