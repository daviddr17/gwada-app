import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { insertContactMessageIfNew } from "@/lib/contacts/contact-inbound-message-insert";
import { resolveOrCreateContactForWhatsappInbound } from "@/lib/contacts/resolve-or-create-inbound-contact-server";
import { whatsappChatIdFromPayloadAddress } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import { displayNameFromWahaChatId } from "@/lib/contact-messages/waha-chat-label";
import { insertInboxSignalServer } from "@/lib/inbox/insert-inbox-signal-server";
import { emitMessageNotificationEventIfNew } from "@/lib/notifications/emit-message-notification-event";
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
  };
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

export async function handleWahaInboundWebhook(
  admin: SupabaseClient,
  body: WahaWebhookBody,
): Promise<{ ok: boolean; imported: boolean; reason?: string }> {
  const event = body.event?.trim();
  if (event !== "message") {
    return { ok: true, imported: false, reason: "ignored_event" };
  }

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

  const bodyText =
    payload.body?.trim() ||
    (payload.hasMedia ? "WhatsApp-Anhang" : "");
  if (!bodyText) {
    return { ok: true, imported: false, reason: "empty_body" };
  }

  if (!contactId) {
    await insertInboxSignalServer(admin, {
      restaurantId,
      source: "waha",
    });

    const messageCreatedAt =
      wahaTimestampToIso(payload.timestamp) ?? new Date().toISOString();
    await emitMessageNotificationEventIfNew(admin, {
      restaurantId,
      referenceId: `waha:${payload.id}`,
      payload: {
        contactId: `waha:${chatId}`,
        contactName: displayNameFromWahaChatId(chatId) ?? "WhatsApp",
        preview: bodyText.slice(0, 120),
        platform: "whatsapp",
        messageCreatedAt,
      },
    });

    return { ok: true, imported: false, reason: "contact_not_linked" };
  }

  const externalSourceId = `waha:${payload.id}`;
  const inserted = await insertContactMessageIfNew(admin, {
    restaurantId,
    contactId,
    platform: "whatsapp",
    direction: "inbound",
    body: bodyText,
    externalSourceId,
    createdAt: wahaTimestampToIso(payload.timestamp),
  });

  return { ok: true, imported: inserted };
}
