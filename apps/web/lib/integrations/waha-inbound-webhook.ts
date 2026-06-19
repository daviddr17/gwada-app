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
import {
  wahaWebhookPayloadMediaKind,
} from "@/lib/contact-messages/waha-message-media";
import {
  whatsappMediaMirrorBody,
} from "@/lib/notifications/message-push-preview";
import { insertInboxSignalServer } from "@/lib/inbox/insert-inbox-signal-server";
import { wahaAckToDeliveryStatus } from "@/lib/waha/waha-message-ack";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import { isWahaDirectMessageChatId } from "@/lib/waha/waha-lids";
import {
  linkOutboundWhatsappFromWahaWebhook,
} from "@/lib/contact-messages/outbound-whatsapp-db-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WahaWebhookBody = {
  event?: string;
  session?: string;
  metadata?: Record<string, string>;
  payload?: {
    id?: string;
    timestamp?: number;
    from?: string;
    to?: string;
    fromMe?: boolean;
    body?: string;
    hasMedia?: boolean;
    ack?: number;
    ackName?: string;
    pushName?: string;
    notifyName?: string;
    _data?: { notifyName?: string; pushName?: string };
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
  const { data: restaurants } = await admin.from("restaurants").select("id");
  for (const r of restaurants ?? []) {
    const id = (r as { id: string }).id;
    if (wahaSessionNameForRestaurant(id) === sessionName) return id;
  }
  return null;
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
  if (event === "message") {
    return handleWahaInboundWebhook(admin, body);
  }
  if (event === "message.ack") {
    return handleWahaMessageAck(admin, body);
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

  const pushName =
    payload.pushName ??
    payload.notifyName ??
    payload._data?.notifyName ??
    payload._data?.pushName ??
    null;

  const identity = await resolveWahaInboundIdentity(admin, {
    restaurantId,
    chatId,
    pushName,
  });
  const conversationLabel = conversationLabelForWahaInboundIdentity(identity);

  const contactId = await resolveOrCreateContactForWhatsappInbound(admin, {
    restaurantId,
    chatId,
    pushName,
  });

  const mediaKind = payload.hasMedia
    ? wahaWebhookPayloadMediaKind(payload)
    : null;
  const bodyText = payload.body?.trim() ?? "";
  if (!bodyText && !payload.hasMedia) {
    return { ok: true, imported: false, reason: "empty_body" };
  }
  const mirrorBody =
    bodyText || whatsappMediaMirrorBody(mediaKind);

  const scheduleAvatarSync = (linkedContactId: string | null) => {
    void syncWhatsappChatAvatarFromWaha(admin, {
      restaurantId,
      chatId,
      linkedContactId,
    }).catch(() => {
      /* Webhook darf nicht warten — Avatar optional */
    });
  };

  if (!contactId) {
    const { imported } = await ingestInboundContactMessage(admin, {
      restaurantId,
      contactId: identity.pseudoContactId,
      platform: "whatsapp",
      direction: "inbound",
      body: mirrorBody,
      externalSourceId: `waha:${payload.id}`,
      createdAt: wahaTimestampToIso(payload.timestamp),
      attachmentKind: mediaKind,
      conversationLabel,
    });

    await insertInboxSignalServer(admin, {
      restaurantId,
      source: "waha",
    });

    scheduleAvatarSync(null);

    return { ok: true, imported };
  }

  const externalSourceId = `waha:${payload.id}`;
  const { imported } = await ingestInboundContactMessage(admin, {
    restaurantId,
    contactId,
    platform: "whatsapp",
    direction: "inbound",
    body: mirrorBody,
    externalSourceId,
    createdAt: wahaTimestampToIso(payload.timestamp),
    attachmentKind: mediaKind,
  });

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

  const mediaKind = payload.hasMedia
    ? wahaWebhookPayloadMediaKind(payload)
    : null;
  const bodyText = payload.body?.trim() ?? "";
  const mirrorBody =
    bodyText || whatsappMediaMirrorBody(mediaKind);

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
  }

  await insertInboxSignalServer(admin, {
    restaurantId,
    source: "waha_ack",
  });

  return { ok: true, imported: false, reason: "ack_signal" };
}
