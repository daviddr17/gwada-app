import "server-only";

import { randomUUID } from "crypto";
import { resolveConversationThreadRef } from "@/lib/contact-messages/conversation-thread-key";
import { sanitizeConversationLabelForStorage } from "@/lib/contact-messages/waha-chat-label";
import { wahaPseudoContactIdFromChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { resolveContactIdByWhatsappChat } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CLIENT_OUTBOUND_EXTERNAL_PREFIX,
  clientOutboundExternalSourceId,
} from "@/lib/contact-messages/outbound-whatsapp-client-id";

export function wahaOutboundExternalSourceId(wahaMessageId: string): string {
  return `waha:${wahaMessageId}`;
}

export function parseWahaSendResponseMessageId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const direct = record.id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const key = record.key;
  if (key && typeof key === "object") {
    const keyId = (key as Record<string, unknown>).id;
    if (typeof keyId === "string" && keyId.trim()) {
      const fromMe = (key as Record<string, unknown>).fromMe === true;
      const remoteJid = (key as Record<string, unknown>).remoteJid;
      const participant = (key as Record<string, unknown>).participant;
      if (typeof remoteJid === "string" && remoteJid.trim()) {
        const parts = [
          fromMe ? "true" : "false",
          remoteJid.trim(),
          keyId.trim(),
        ];
        if (typeof participant === "string" && participant.trim()) {
          parts.push(participant.trim());
        }
        return parts.join("_");
      }
      return keyId.trim();
    }
  }

  return null;
}

export async function insertPendingOutboundWhatsappMessage(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    threadContactId: string;
    body: string;
    sentBy?: string | null;
    sentByLabel?: string | null;
    clientSendId?: string;
    sendBatchId?: string | null;
    deliveryStatus?: string;
  },
): Promise<
  | { ok: true; messageId: string; clientSendId: string }
  | { ok: false; error: string }
> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { ok: false, error: "invalid_restaurant" };
  }

  const thread = resolveConversationThreadRef(params.threadContactId);
  if (!thread.contactId && !thread.conversationKey) {
    return { ok: false, error: "invalid_thread" };
  }

  const clientSendId = params.clientSendId?.trim() || randomUUID();
  const externalSourceId = clientOutboundExternalSourceId(clientSendId);

  const { data: existing } = await admin
    .from("contact_messages")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("external_source_id", externalSourceId)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      messageId: (existing as { id: string }).id,
      clientSendId,
    };
  }

  const { data, error } = await admin
    .from("contact_messages")
    .insert({
      restaurant_id: params.restaurantId,
      contact_id: thread.contactId,
      conversation_key: thread.conversationKey,
      conversation_label: thread.conversationKey
        ? sanitizeConversationLabelForStorage(null)
        : null,
      platform: "whatsapp",
      direction: "outbound",
      body: params.body.trim() || " ",
      reservation_id: null,
      sent_by: params.sentBy ?? null,
      sent_by_label: params.sentByLabel ?? null,
      delivery_status: params.deliveryStatus ?? "pending",
      external_source_id: externalSourceId,
      suppress_notifications: true,
      send_batch_id: params.sendBatchId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  return {
    ok: true,
    messageId: (data as { id: string }).id,
    clientSendId,
  };
}

export async function finalizeOutboundWhatsappMessage(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    messageId: string;
    deliveryStatus: string;
    wahaMessageId?: string | null;
  },
): Promise<void> {
  const patch: Record<string, string> = {
    delivery_status: params.deliveryStatus,
  };
  if (params.wahaMessageId?.trim()) {
    patch.external_source_id = wahaOutboundExternalSourceId(
      params.wahaMessageId.trim(),
    );
  }

  await admin
    .from("contact_messages")
    .update(patch)
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.messageId);
}

export async function linkOutboundWhatsappFromWahaWebhook(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId: string;
    wahaMessageId: string;
    body: string;
    createdAt?: string;
    deliveryStatus?: string;
  },
): Promise<{ linked: boolean; messageId?: string; imported: boolean }> {
  const wahaId = params.wahaMessageId.trim();
  if (!wahaId) return { linked: false, imported: false };

  const externalSourceId = wahaOutboundExternalSourceId(wahaId);

  const { data: existing } = await admin
    .from("contact_messages")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("external_source_id", externalSourceId)
    .maybeSingle();

  if (existing) {
    if (params.deliveryStatus) {
      await admin
        .from("contact_messages")
        .update({ delivery_status: params.deliveryStatus })
        .eq("id", (existing as { id: string }).id);
    }
    return {
      linked: true,
      messageId: (existing as { id: string }).id,
      imported: false,
    };
  }

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const bodyTrim = params.body.trim();
  const pseudoThreadKey = wahaPseudoContactIdFromChatId(params.chatId);
  const linkedContactId = await resolveContactIdByWhatsappChat(admin, {
    restaurantId: params.restaurantId,
    chatId: params.chatId,
  });

  let pendingQuery = admin
    .from("contact_messages")
    .select("id, body, external_source_id, contact_id, conversation_key")
    .eq("restaurant_id", params.restaurantId)
    .eq("direction", "outbound")
    .eq("platform", "whatsapp")
    .like("external_source_id", `${CLIENT_OUTBOUND_EXTERNAL_PREFIX}%`)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(12);

  const { data: pendingRows } = await pendingQuery;
  const pending = (pendingRows ?? []).find((row) => {
    const record = row as {
      body: string;
      contact_id: string | null;
      conversation_key: string | null;
    };
    const matchesThread =
      record.conversation_key === pseudoThreadKey ||
      (linkedContactId != null && record.contact_id === linkedContactId);
    if (!matchesThread) return false;

    const stored = record.body?.trim() ?? "";
    if (!bodyTrim && !stored) return true;
    if (!bodyTrim || !stored) return false;
    return stored === bodyTrim || stored.includes(bodyTrim) || bodyTrim.includes(stored);
  });

  if (pending) {
    await admin
      .from("contact_messages")
      .update({
        external_source_id: externalSourceId,
        ...(params.deliveryStatus
          ? { delivery_status: params.deliveryStatus }
          : {}),
      })
      .eq("id", (pending as { id: string }).id);

    return {
      linked: true,
      messageId: (pending as { id: string }).id,
      imported: false,
    };
  }

  const thread = linkedContactId
    ? resolveConversationThreadRef(linkedContactId)
    : resolveConversationThreadRef(pseudoThreadKey);

  const { data: inserted, error } = await admin
    .from("contact_messages")
    .insert({
      restaurant_id: params.restaurantId,
      contact_id: thread.contactId,
      conversation_key: thread.conversationKey,
      platform: "whatsapp",
      direction: "outbound",
      body: bodyTrim || " ",
      reservation_id: null,
      sent_by: null,
      delivery_status: params.deliveryStatus ?? "sent",
      external_source_id: externalSourceId,
      suppress_notifications: true,
      ...(params.createdAt ? { created_at: params.createdAt } : {}),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { linked: false, imported: false };
  }

  return {
    linked: true,
    messageId: (inserted as { id: string }).id,
    imported: true,
  };
}

export function wahaThreadContactIdFromChatId(chatId: string): string {
  return wahaPseudoContactIdFromChatId(chatId);
}
