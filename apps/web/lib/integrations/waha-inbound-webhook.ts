import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { ingestInboundContactMessage } from "@/lib/contacts/ingest-inbound-contact-message";
import { resolveOrCreateContactForWhatsappInbound } from "@/lib/contacts/resolve-or-create-inbound-contact-server";
import { whatsappChatIdFromPayloadAddress } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import {
  wahaWebhookPayloadMediaKind,
} from "@/lib/contact-messages/waha-message-media";
import {
  buildMessagePushPreview,
  whatsappMediaMirrorBody,
} from "@/lib/notifications/message-push-preview";
import { insertInboxSignalServer } from "@/lib/inbox/insert-inbox-signal-server";
import { emitMessageNotificationEventIfNew } from "@/lib/notifications/emit-message-notification-event";
import { resolveMessageNotificationSender } from "@/lib/notifications/message-notification-sender";
import { scheduleNotificationDeliverForEvent } from "@/lib/notifications/schedule-notification-deliver";
import { wahaAckToDeliveryStatus } from "@/lib/waha/waha-message-ack";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import { isWahaDirectMessageChatId } from "@/lib/waha/waha-lids";
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

export async function handleWahaInboundWebhook(
  admin: SupabaseClient,
  body: WahaWebhookBody,
): Promise<WahaWebhookResult> {
  const payload = body.payload;
  if (!payload?.id || payload.fromMe === true) {
    return { ok: true, imported: false, reason: "skipped_outbound" };
  }

  let restaurantId = restaurantIdFromWebhook(body);
  if (!restaurantId && body.session) {
    restaurantId = await restaurantIdFromSessionName(admin, body.session);
  }
  if (!restaurantId) {
    return { ok: false, imported: false, reason: "unknown_restaurant" };
  }

  const chatId = whatsappChatIdFromPayloadAddress(payload.from);
  if (!chatId) {
    return { ok: true, imported: false, reason: "no_chat_id" };
  }
  if (!isWahaDirectMessageChatId(chatId)) {
    return { ok: true, imported: false, reason: "non_direct_chat" };
  }

  const contactId = await resolveOrCreateContactForWhatsappInbound(admin, {
    restaurantId,
    chatId,
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

  if (!contactId) {
    await insertInboxSignalServer(admin, {
      restaurantId,
      source: "waha",
    });

    const messageCreatedAt =
      wahaTimestampToIso(payload.timestamp) ?? new Date().toISOString();
    const pseudoContactId = `waha:${chatId}`;
    const sender = await resolveMessageNotificationSender(admin, {
      restaurantId,
      contactId: pseudoContactId,
      platform: "whatsapp",
    });
    const preview = buildMessagePushPreview({
      body: mirrorBody,
      attachmentKind: mediaKind,
      senderName: sender.contactName,
    });
    const { eventId } = await emitMessageNotificationEventIfNew(admin, {
      restaurantId,
      referenceId: `waha:${payload.id}`,
      payload: {
        contactId: pseudoContactId,
        contactName: sender.contactName,
        ...(sender.senderPhone ? { senderPhone: sender.senderPhone } : {}),
        preview,
        platform: "whatsapp",
        messageCreatedAt,
      },
    });
    if (eventId) {
      scheduleNotificationDeliverForEvent(admin, eventId);
    }

    return { ok: true, imported: false, reason: "contact_not_linked" };
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

  return { ok: true, imported };
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
