import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { ingestInboundContactMessage } from "@/lib/contacts/ingest-inbound-contact-message";
import { syncWhatsappChatAvatarFromWaha } from "@/lib/contacts/sync-whatsapp-chat-avatar-server";
import { resolveOrCreateContactForWhatsappInbound } from "@/lib/contacts/resolve-or-create-inbound-contact-server";
import { whatsappChatIdFromPayloadAddress } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import {
  conversationLabelForWahaInboundIdentity,
  resolveWahaInboundIdentity,
} from "@/lib/contact-messages/waha-inbound-identity-server";
import { resolveWahaInboundMirrorContent } from "@/lib/contact-messages/waha-message-content";
import { persistWahaAttachmentMeta } from "@/lib/contact-messages/persist-waha-attachment-meta";
import { persistWahaConversationDisplayLabel } from "@/lib/contact-messages/persist-waha-conversation-label-server";
import { insertInboxSignalServer } from "@/lib/inbox/insert-inbox-signal-server";
import { applyContactMessageReactionEvent } from "@/lib/waha/apply-contact-message-reaction";
import { wahaAckToDeliveryStatus } from "@/lib/waha/waha-message-ack";
import { isWahaDirectMessageChatId } from "@/lib/waha/waha-lids";
import {
  parseWahaReplyQuote,
  wahaExternalSourceId,
} from "@/lib/waha/waha-reply-quote";
import {
  linkOutboundWhatsappFromWahaWebhook,
} from "@/lib/contact-messages/outbound-whatsapp-db-server";
import {
  setMirrorThreadExternalSeenInDb,
  setWhatsappMessageExternalSeenInDb,
} from "@/lib/contacts/message-thread-external-seen-db";
import {
  integrationStateFromWahaSession,
  upsertRestaurantWhatsappIntegration,
} from "@/lib/supabase/restaurant-integrations-db";
import { findRestaurantIdByWahaSessionNameAdmin } from "@/lib/supabase/waha-servers-db";
import type { ContactMessageReaction } from "@/lib/supabase/contact-messages-db";
import type { WahaSessionStatus } from "@/lib/types/restaurant-integration";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WahaWebhookBody = {
  event?: string;
  session?: string;
  metadata?: Record<string, string>;
  me?: {
    id?: string;
    pushName?: string;
    name?: string;
  } | null;
  payload?: {
    id?: string;
    timestamp?: number;
    from?: string;
    to?: string;
    fromMe?: boolean;
    participant?: string;
    body?: string;
    hasMedia?: boolean;
    ack?: number;
    ackName?: string;
    pushName?: string;
    notifyName?: string;
    verifiedBizName?: string;
    /** session.status */
    status?: WahaSessionStatus | string;
    replyTo?: unknown;
    reaction?: {
      text?: string | null;
      messageId?: string | null;
    };
    _data?: {
      notifyName?: string;
      pushName?: string;
      verifiedBizName?: string;
      verifiedName?: string;
      businessName?: string;
    };
  };
};

export type WahaWebhookResult = {
  ok: boolean;
  imported?: boolean;
  reason?: string;
};

export function verifyWahaWebhookHmac(
  rawBody: string,
  header: string | null,
): boolean {
  const secret = process.env.WAHA_WEBHOOK_HMAC_KEY?.trim();
  if (!secret) return true;
  if (!header?.trim()) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(header.trim(), "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function restaurantIdFromWebhook(body: WahaWebhookBody): string | null {
  const meta = body.metadata?.["gwada.restaurant_id"]?.trim();
  if (meta) return meta;
  const session = body.session?.trim();
  if (!session?.startsWith("gwada")) return null;
  return null;
}

async function restaurantIdFromSessionName(
  admin: SupabaseClient,
  sessionName: string,
): Promise<string | null> {
  return findRestaurantIdByWahaSessionNameAdmin(sessionName, admin);
}

function wahaTimestampToIso(ts: number | undefined): string | undefined {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return undefined;
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return new Date(ms).toISOString();
}

export async function handleWahaWebhook(
  admin: SupabaseClient,
  body: WahaWebhookBody,
): Promise<WahaWebhookResult> {
  const event = body.event?.trim();
  // `message` = inbound; `message.any` = all creations including phone fromMe.
  // Dedup via external_source_id / outbound link — safe if both fire.
  if (event === "message" || event === "message.any") {
    return handleWahaInboundWebhook(admin, body);
  }
  if (event === "message.ack") {
    return handleWahaMessageAck(admin, body);
  }
  if (event === "message.reaction") {
    return handleWahaMessageReaction(admin, body);
  }
  if (event === "session.status") {
    return handleWahaSessionStatus(admin, body);
  }
  return { ok: true, imported: false, reason: "ignored_event" };
}

function chatIdFromWahaMessagePayload(payload: NonNullable<WahaWebhookBody["payload"]>): string | null {
  if (payload.fromMe === true) {
    return (
      whatsappChatIdFromPayloadAddress(payload.to) ??
      whatsappChatIdFromPayloadAddress(payload.from)
    );
  }
  return whatsappChatIdFromPayloadAddress(payload.from);
}

export async function handleWahaInboundWebhook(
  admin: SupabaseClient,
  body: WahaWebhookBody,
): Promise<WahaWebhookResult> {
  const payload = body.payload;
  if (!payload?.id) {
    return { ok: true, imported: false, reason: "no_message_id" };
  }

  if (payload.fromMe === true) {
    return handleWahaOutboundMirrorWebhook(admin, body);
  }

  let restaurantId = restaurantIdFromWebhook(body);
  if (!restaurantId && body.session) {
    restaurantId = await restaurantIdFromSessionName(admin, body.session);
  }
  if (!restaurantId) {
    return { ok: false, imported: false, reason: "unknown_restaurant" };
  }

  const chatId = chatIdFromWahaMessagePayload(payload);
  if (!chatId) {
    return { ok: true, imported: false, reason: "no_chat_id" };
  }
  if (!isWahaDirectMessageChatId(chatId)) {
    return { ok: true, imported: false, reason: "non_direct_chat" };
  }

  const businessName =
    payload.verifiedBizName ??
    payload._data?.verifiedBizName ??
    payload._data?.verifiedName ??
    payload._data?.businessName ??
    null;
  const pushName =
    businessName ??
    payload.pushName ??
    payload.notifyName ??
    payload._data?.notifyName ??
    payload._data?.pushName ??
    null;

  const identity = await resolveWahaInboundIdentity(admin, {
    restaurantId,
    chatId,
    pushName,
    verifiedBizName: businessName,
  });
  const conversationLabel = conversationLabelForWahaInboundIdentity(identity);

  const contactId = await resolveOrCreateContactForWhatsappInbound(admin, {
    restaurantId,
    chatId,
    pushName,
  });

  const mirrored = resolveWahaInboundMirrorContent(payload);
  if (!mirrored.hasContent) {
    return {
      ok: true,
      imported: false,
      reason: "empty_body",
    };
  }
  const mirrorBody = mirrored.body || "WhatsApp-Nachricht";
  const mediaKind = mirrored.mediaKind;
  const quote = parseWahaReplyQuote(payload);

  const scheduleAvatarSync = (linkedContactId: string | null) => {
    void syncWhatsappChatAvatarFromWaha(admin, {
      restaurantId,
      chatId,
      linkedContactId,
    }).catch(() => {
      /* Webhook darf nicht warten — Avatar optional */
    });
  };

  const persistMediaMeta = (messageId: string | undefined) => {
    if (!messageId || !mediaKind) return;
    void persistWahaAttachmentMeta(admin, {
      restaurantId,
      messageId,
      chatId,
      wahaMessageId: payload.id!,
      mediaKind,
    }).catch(() => {
      /* Meta optional — Caption bleibt in body */
    });
  };

  if (!contactId) {
    const { imported, messageId } = await ingestInboundContactMessage(admin, {
      restaurantId,
      contactId: identity.pseudoContactId,
      platform: "whatsapp",
      direction: "inbound",
      body: mirrorBody,
      externalSourceId: `waha:${payload.id}`,
      createdAt: wahaTimestampToIso(payload.timestamp),
      attachmentKind: mediaKind,
      conversationLabel,
      externalSeen: false,
      replyToExternalSourceId: quote?.messageId
        ? wahaExternalSourceId(quote.messageId)
        : null,
      replyToBody: quote?.body ?? null,
    });

    if (conversationLabel) {
      void persistWahaConversationDisplayLabel(admin, {
        restaurantId,
        conversationKey: identity.pseudoContactId,
        label: conversationLabel,
      }).catch(() => {
        /* Label-Backfill optional */
      });
    }

    await insertInboxSignalServer(admin, {
      restaurantId,
      source: "waha",
    });

    if (imported) persistMediaMeta(messageId);
    scheduleAvatarSync(null);

    return { ok: true, imported };
  }

  const externalSourceId = `waha:${payload.id}`;
  const { imported, messageId } = await ingestInboundContactMessage(admin, {
    restaurantId,
    contactId,
    platform: "whatsapp",
    direction: "inbound",
    body: mirrorBody,
    externalSourceId,
    createdAt: wahaTimestampToIso(payload.timestamp),
    attachmentKind: mediaKind,
    externalSeen: false,
    replyToExternalSourceId: quote?.messageId
      ? wahaExternalSourceId(quote.messageId)
      : null,
    replyToBody: quote?.body ?? null,
  });

  if (imported) persistMediaMeta(messageId);
  scheduleAvatarSync(contactId);

  return { ok: true, imported };
}

async function handleWahaOutboundMirrorWebhook(
  admin: SupabaseClient,
  body: WahaWebhookBody,
): Promise<WahaWebhookResult> {
  const payload = body.payload;
  if (!payload?.id) {
    return { ok: true, imported: false, reason: "no_message_id" };
  }

  let restaurantId = restaurantIdFromWebhook(body);
  if (!restaurantId && body.session) {
    restaurantId = await restaurantIdFromSessionName(admin, body.session);
  }
  if (!restaurantId) {
    return { ok: false, imported: false, reason: "unknown_restaurant" };
  }

  const chatId = chatIdFromWahaMessagePayload(payload);
  if (!chatId || !isWahaDirectMessageChatId(chatId)) {
    return { ok: true, imported: false, reason: "non_direct_chat" };
  }

  const mirrored = resolveWahaInboundMirrorContent(payload);
  const mirrorBody = mirrored.body || " ";

  const ack =
    typeof payload.ack === "number" && Number.isFinite(payload.ack)
      ? payload.ack
      : null;
  const deliveryStatus =
    ack != null ? wahaAckToDeliveryStatus(ack, true) : "sent";

  const linked = await linkOutboundWhatsappFromWahaWebhook(admin, {
    restaurantId,
    chatId,
    wahaMessageId: payload.id,
    body: mirrorBody,
    createdAt: wahaTimestampToIso(payload.timestamp),
    deliveryStatus,
  });

  if (linked.imported && linked.messageId && mirrored.mediaKind) {
    void persistWahaAttachmentMeta(admin, {
      restaurantId,
      messageId: linked.messageId,
      chatId,
      wahaMessageId: payload.id,
      mediaKind: mirrored.mediaKind,
    }).catch(() => {
      /* Meta optional */
    });
  }

  await insertInboxSignalServer(admin, {
    restaurantId,
    source: "waha_ack",
  });

  return {
    ok: true,
    imported: linked.imported,
    reason: linked.linked ? "outbound_linked" : "outbound_unlinked",
  };
}

export async function handleWahaMessageAck(
  admin: SupabaseClient,
  body: WahaWebhookBody,
): Promise<WahaWebhookResult> {
  const payload = body.payload;
  if (!payload?.id) {
    return { ok: true, imported: false, reason: "no_message_id" };
  }

  let restaurantId = restaurantIdFromWebhook(body);
  if (!restaurantId && body.session) {
    restaurantId = await restaurantIdFromSessionName(admin, body.session);
  }
  if (!restaurantId) {
    return { ok: false, imported: false, reason: "unknown_restaurant" };
  }

  const fromMe = payload.fromMe === true;
  const ack =
    typeof payload.ack === "number" && Number.isFinite(payload.ack)
      ? payload.ack
      : null;
  const externalSourceId = `waha:${payload.id}`;

  if (ack != null) {
    const deliveryStatus = wahaAckToDeliveryStatus(ack, fromMe);
    await admin
      .from("contact_messages")
      .update({ delivery_status: deliveryStatus })
      .eq("restaurant_id", restaurantId)
      .eq("external_source_id", externalSourceId);

    if (!fromMe && ack >= 3) {
      const wahaMessageId = payload.id.trim();
      await setWhatsappMessageExternalSeenInDb(admin, {
        restaurantId,
        wahaMessageId,
        seen: true,
      });

      const { data: msgRow } = await admin
        .from("contact_messages")
        .select("contact_id, conversation_key")
        .eq("restaurant_id", restaurantId)
        .eq("external_source_id", externalSourceId)
        .maybeSingle();

      const row = msgRow as {
        contact_id: string | null;
        conversation_key: string | null;
      } | null;
      const conversationKey = row?.contact_id ?? row?.conversation_key ?? null;
      if (conversationKey) {
        await setMirrorThreadExternalSeenInDb(admin, {
          restaurantId,
          conversationKey,
          platform: "whatsapp",
          seen: true,
        });
      }
    }
  }

  await insertInboxSignalServer(admin, {
    restaurantId,
    source: "waha_ack",
  });

  return { ok: true, imported: false, reason: "ack_signal" };
}

export async function handleWahaMessageReaction(
  admin: SupabaseClient,
  body: WahaWebhookBody,
): Promise<WahaWebhookResult> {
  const payload = body.payload;
  const targetId = payload?.reaction?.messageId?.trim();
  if (!targetId) {
    return { ok: true, imported: false, reason: "no_reaction_target" };
  }

  let restaurantId = restaurantIdFromWebhook(body);
  if (!restaurantId && body.session) {
    restaurantId = await restaurantIdFromSessionName(admin, body.session);
  }
  if (!restaurantId) {
    return { ok: false, imported: false, reason: "unknown_restaurant" };
  }

  const emoji = (payload?.reaction?.text ?? "").trim();
  const fromMe = payload?.fromMe === true;
  const senderId =
    payload?.participant?.trim() ||
    payload?.from?.trim() ||
    undefined;

  const externalSourceId = wahaExternalSourceId(targetId);
  const { data: msgRow } = await admin
    .from("contact_messages")
    .select("id, reactions")
    .eq("restaurant_id", restaurantId)
    .eq("external_source_id", externalSourceId)
    .maybeSingle();

  const row = msgRow as {
    id: string;
    reactions: ContactMessageReaction[] | null;
  } | null;

  let nextReactions: ContactMessageReaction[] | null = null;
  if (row) {
    nextReactions = applyContactMessageReactionEvent(row.reactions, {
      emoji,
      fromMe,
      senderId,
    });
    await admin
      .from("contact_messages")
      .update({ reactions: nextReactions })
      .eq("restaurant_id", restaurantId)
      .eq("id", row.id);
  }

  await insertInboxSignalServer(admin, {
    restaurantId,
    source: "waha_reaction",
    payload: {
      wahaMessageId: targetId,
      emoji,
      fromMe,
      senderId: senderId ?? null,
    },
  });

  return {
    ok: true,
    imported: Boolean(row),
    reason: row ? "reaction_patched" : "reaction_signal_only",
  };
}

export async function handleWahaSessionStatus(
  admin: SupabaseClient,
  body: WahaWebhookBody,
): Promise<WahaWebhookResult> {
  const statusRaw = body.payload?.status;
  if (!statusRaw || typeof statusRaw !== "string") {
    return { ok: true, imported: false, reason: "no_status" };
  }

  let restaurantId = restaurantIdFromWebhook(body);
  if (!restaurantId && body.session) {
    restaurantId = await restaurantIdFromSessionName(admin, body.session);
  }
  if (!restaurantId) {
    return { ok: false, imported: false, reason: "unknown_restaurant" };
  }

  const mapped = integrationStateFromWahaSession({
    name: body.session,
    status: statusRaw as WahaSessionStatus,
    me: body.me ?? null,
  });

  const { error } = await upsertRestaurantWhatsappIntegration(
    admin,
    restaurantId,
    {
      status: mapped.status,
      phone_number: mapped.phone_number,
      display_name: mapped.display_name,
      connected_at: mapped.connected_at,
      last_error: mapped.status === "failed" ? "session_status_failed" : null,
    },
  );

  if (error) {
    console.warn("[waha] session.status upsert", error);
    return { ok: false, imported: false, reason: "upsert_failed" };
  }

  return { ok: true, imported: true, reason: "session_status" };
}
