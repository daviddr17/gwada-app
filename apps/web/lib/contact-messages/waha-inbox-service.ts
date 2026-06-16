import "server-only";

import { normalizeContactPhone } from "@/lib/contacts/normalize-contact-identity";
import { resolveWahaChatDisplayName } from "@/lib/contact-messages/waha-chat-display-name";
import {
  displayNameFromWahaChatId,
  extractPhoneDigitsFromWahaOverview,
  isBareWhatsAppPlaceholderName,
  resolveWahaOverviewChatId,
  wahaChatListDisplayName,
  type WahaInboxLookupMaps,
} from "@/lib/contact-messages/waha-chat-label";
import {
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import { contactDisplayName } from "@/lib/supabase/contacts-db";
import {
  applyWahaReactionEvent,
  isWahaReactionEventMessage,
  mergeReactionsOntoRow,
  parseReactionsFromWahaMessage,
} from "@/lib/waha/waha-message-reactions";
import { wahaMediaProxyUrl } from "@/lib/contact-messages/contact-message-attachment-urls";
import {
  parseWahaMessageMedia,
  wahaMessageHasDisplayableMedia,
} from "@/lib/contact-messages/waha-message-media";
import {
  wahaGetChatMessages,
  wahaEffectiveUnreadCount,
  wahaGetChatsOverview,
  wahaTimestampToIso,
  type WahaChatMessage,
  type WahaChatOverviewItem,
} from "@/lib/waha/waha-inbox";
import { wahaAckToDeliveryStatus } from "@/lib/waha/waha-message-ack";
import { wahaLastMessagePreview } from "@/lib/waha/waha-last-message-preview";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import type {
  ContactMessageReaction,
  ContactMessageRow,
} from "@/lib/supabase/contact-messages-db";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import { digitsFromWhatsAppChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import {
  isWahaLidChatId,
  isWahaDirectMessageChatId,
  wahaGetAllContacts,
  wahaGetAllLidMappings,
  wahaResolveLidToPhoneChatId,
  type WahaContactInfo,
} from "@/lib/waha/waha-lids";
import type { SupabaseClient } from "@supabase/supabase-js";

const DISPLAY_NAME_CONCURRENCY = 6;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export async function fetchWahaInboxConversations(
  admin: SupabaseClient,
  restaurantId: string,
  options?: { skipDisplayNameResolve?: boolean },
): Promise<{ data: ContactConversationPreview[]; error: string | null }> {
  const config = await getWahaServerConfigAdmin();
  if (!config) {
    return { data: [], error: "waha_not_configured" };
  }

  const [overview, allContacts, allLids] = await Promise.all([
    wahaGetChatsOverview({
      config,
      restaurantId,
      limit: 100,
    }),
    wahaGetAllContacts({ config, restaurantId }),
    wahaGetAllLidMappings({ config, restaurantId }),
  ]);
  if (!overview.ok) {
    return { data: [], error: overview.error };
  }

  const lidToPn = new Map<string, string>();
  for (const row of allLids.data) {
    const lid = row.lid?.trim();
    const pn = row.pn?.trim();
    if (!lid || !pn) continue;
    lidToPn.set(lid, pn);
    lidToPn.set(lid.toLowerCase(), pn);
  }

  const contactByChatId = new Map<string, WahaContactInfo>();
  for (const contact of allContacts.data) {
    const id = contact.id?.trim();
    if (!id) continue;
    contactByChatId.set(id, contact);
    contactByChatId.set(id.toLowerCase(), contact);
  }

  const lookupMaps: WahaInboxLookupMaps = { lidToPn, contactByChatId };

  const { data: contacts } = await admin
    .from("contacts")
    .select(
      `
      id,
      first_name,
      last_name,
      company,
      contact_phones ( phone_display, phone_normalized, is_primary, sort_order )
    `,
    )
    .eq("restaurant_id", restaurantId);

  const phoneToContact = new Map<
    string,
    { id: string; name: string; company: string | null }
  >();
  for (const c of contacts ?? []) {
    const row = c as Record<string, unknown>;
    const phones = row.contact_phones;
    const list = Array.isArray(phones) ? phones : [];
    const id = row.id as string;
    const name = contactDisplayName({
      first_name: row.first_name as string,
      last_name: row.last_name as string,
    });
    const company =
      typeof row.company === "string" ? row.company.trim() || null : null;
    for (const p of list) {
      const pr = p as { phone_normalized: string; phone_display: string };
      const norm =
        pr.phone_normalized?.trim() ||
        normalizeContactPhone(pr.phone_display);
      if (norm) phoneToContact.set(norm, { id, name, company });
    }
  }

  type PendingPreview = {
    chat: WahaChatOverviewItem;
    chatId: string;
    contact_id: string;
    contact_name: string;
    last_body: string;
    last_at: string;
    last_direction: ContactConversationPreview["last_direction"];
    last_is_reaction: boolean;
    last_attachment_kind?: ContactConversationPreview["last_attachment_kind"];
    message_count: number;
    needsResolve: boolean;
  };

  const pending: PendingPreview[] = [];

  for (const chat of overview.data) {
    const chatId = resolveWahaOverviewChatId(chat, lookupMaps);
    if (!chatId || !isWahaDirectMessageChatId(chatId)) continue;

    let phoneDigits =
      extractPhoneDigitsFromWahaOverview(chat, lookupMaps) ??
      digitsFromWhatsAppChatId(chatId);

    if (!phoneDigits && isWahaLidChatId(chatId)) {
      const { pn } = await wahaResolveLidToPhoneChatId({
        config,
        restaurantId,
        lidChatId: chatId,
      });
      if (pn) phoneDigits = digitsFromWhatsAppChatId(pn);
    }

    const matched = phoneDigits ? phoneToContact.get(phoneDigits) : undefined;
    const last = chat.lastMessage;
    const preview = wahaLastMessagePreview(last ?? undefined);
    const lastAt = wahaTimestampToIso(last?.timestamp ?? undefined);

    const overviewId = (chat.id ?? "").trim();
    const wahaContact =
      contactByChatId.get(chatId) ??
      contactByChatId.get(chatId.toLowerCase()) ??
      (overviewId
        ? contactByChatId.get(overviewId) ??
          contactByChatId.get(overviewId.toLowerCase())
        : undefined);

    const { label, needsApiResolve } = wahaChatListDisplayName({
      chatId,
      overviewChat: chat,
      overviewName: chat.name,
      matchedContactName: matched?.name,
      matchedContactCompany: matched?.company ?? null,
      wahaContact,
      lookupMaps,
      preresolvedDigits: phoneDigits,
    });

    const canonicalChatId =
      phoneDigits && guestPhoneToWhatsAppChatId(phoneDigits)
        ? guestPhoneToWhatsAppChatId(phoneDigits)!
        : chatId;

    pending.push({
      chat,
      chatId: canonicalChatId,
      contact_id: matched?.id ?? `waha:${canonicalChatId}`,
      contact_name: label,
      last_body: preview.text,
      last_at: lastAt,
      last_direction: last?.fromMe ? "outbound" : "inbound",
      last_is_reaction: preview.isReaction,
      last_attachment_kind: preview.isReaction
        ? undefined
        : preview.attachmentKind,
      message_count: wahaEffectiveUnreadCount(chat),
      needsResolve: needsApiResolve,
    });
  }

  const toResolve = options?.skipDisplayNameResolve
    ? []
    : pending.filter((p) => p.needsResolve);
  if (toResolve.length > 0) {
    await mapPool(toResolve, DISPLAY_NAME_CONCURRENCY, async (item) => {
      const overviewId = (item.chat.id ?? "").trim();
      const wahaContact =
        contactByChatId.get(item.chatId) ??
        contactByChatId.get(item.chatId.toLowerCase()) ??
        (overviewId
          ? contactByChatId.get(overviewId) ??
            contactByChatId.get(overviewId.toLowerCase())
          : undefined);
      item.contact_name = await resolveWahaChatDisplayName({
        config,
        restaurantId,
        chatId: item.chatId,
        overviewName: item.chat.name,
        overviewChat: item.chat,
        lookupMaps,
        wahaContact,
      });
    });
  }

  const previews: ContactConversationPreview[] = pending.map((p) => {
    let contact_name = p.contact_name;
    if (
      isBareWhatsAppPlaceholderName(contact_name) &&
      isWahaPseudoContactId(p.contact_id)
    ) {
      const fromPseudo = displayNameFromWahaChatId(
        wahaChatIdFromPseudoContactId(p.contact_id) ?? p.chatId,
      );
      if (fromPseudo) contact_name = fromPseudo;
    }
    const unreadCount = p.message_count ?? 0;
    return {
      contact_id: p.contact_id,
      contact_name,
      platform: "whatsapp" as const,
      last_body: p.last_body,
      last_at: p.last_at,
      last_direction: p.last_direction,
      last_is_reaction: p.last_is_reaction,
      last_attachment_kind: p.last_attachment_kind,
      message_count: 0,
      unread_count: unreadCount,
      is_unread: unreadCount > 0,
      has_reservation_link: false,
      whatsapp_unread_count: unreadCount,
    };
  });

  previews.sort((a, b) => b.last_at.localeCompare(a.last_at));
  return { data: previews, error: null };
}

export async function fetchWahaThreadMessages(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    chatIdOverride?: string | null;
  },
): Promise<{ data: ContactMessageRow[]; error: string | null }> {
  const config = await getWahaServerConfigAdmin();
  if (!config) {
    return { data: [], error: "waha_not_configured" };
  }

  let chatId = params.chatIdOverride?.trim() || null;
  if (!chatId && params.contactId.startsWith("waha:")) {
    chatId = params.contactId.slice(5);
  }
  if (!chatId) {
    const phone = await resolveWhatsappPhoneForContact(admin, {
      restaurantId: params.restaurantId,
      contactId: params.contactId,
      reservationId: null,
    });
    chatId = phone ? guestPhoneToWhatsAppChatId(phone) : null;
  }
  if (!chatId) {
    return { data: [], error: "no_whatsapp_chat" };
  }

  const result = await wahaGetChatMessages({
    config,
    restaurantId: params.restaurantId,
    chatId,
    limit: 100,
    downloadMedia: false,
  });
  if (!result.ok) {
    return { data: [], error: result.error };
  }

  const { data: dbLinked } = await admin
    .from("contact_messages")
    .select("reservation_id, body, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", "whatsapp")
    .not("reservation_id", "is", null);

  const reservationByBody = new Map<string, string>();
  for (const m of dbLinked ?? []) {
    const row = m as { reservation_id: string; body: string };
    reservationByBody.set(row.body.trim(), row.reservation_id);
  }

  const reactionsByMessageId = new Map<string, ContactMessageReaction[]>();

  for (const m of result.data) {
    if (isWahaReactionEventMessage(m)) {
      applyWahaReactionEvent(m, reactionsByMessageId);
    }
  }

  const rows: ContactMessageRow[] = result.data
    .filter(
      (m) =>
        !isWahaReactionEventMessage(m) &&
        ((m.body ?? "").trim().length > 0 || wahaMessageHasDisplayableMedia(m)),
    )
    .map((m: WahaChatMessage) => {
      const body = (m.body ?? "").trim();
      const media = parseWahaMessageMedia(m);
      const reactions = mergeReactionsOntoRow(
        m.id,
        parseReactionsFromWahaMessage(m),
        reactionsByMessageId,
      );
      const fromMe = Boolean(m.fromMe);
      return {
        id: `waha:${m.id}`,
        restaurant_id: params.restaurantId,
        contact_id: params.contactId,
        platform: "whatsapp" as const,
        direction: (fromMe ? "outbound" : "inbound") as ContactMessageRow["direction"],
        body,
        reservation_id: reservationByBody.get(body) ?? null,
        sent_by: null,
        delivery_status: wahaAckToDeliveryStatus(m.ack, fromMe),
        created_at: wahaTimestampToIso(m.timestamp),
        waha_message_id: m.id,
        waha_ack: typeof m.ack === "number" ? m.ack : null,
        reactions,
        attachments: media
          ? [
              {
                id: "0",
                kind: media.kind,
                fileName: media.filename,
                mimeType: media.mimetype,
                durationSeconds: media.durationSeconds ?? null,
                url: wahaMediaProxyUrl({
                  restaurantId: params.restaurantId,
                  chatId,
                  messageId: m.id,
                }),
              },
            ]
          : undefined,
      };
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return { data: rows, error: null };
}
