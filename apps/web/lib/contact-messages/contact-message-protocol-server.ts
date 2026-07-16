import "server-only";

function displayPlatformFromMessage(message: {
  platform: ContactMessagePlatform;
  external_source_id: string | null;
}): ContactMessagePlatform {
  const ext = message.external_source_id?.trim() ?? "";
  if (ext.startsWith("email-imap:")) return "email";
  if (ext.startsWith("waha:")) return "whatsapp";
  return message.platform;
}
import type {
  ContactMessageProtocolEvent,
  ContactMessageProtocolPayload,
} from "@/lib/contact-messages/contact-message-protocol-types";
import { conversationThreadKeyFromRow } from "@/lib/contact-messages/conversation-thread-key";
import { CONTACT_MESSAGE_PLATFORM_LABELS } from "@/lib/constants/contact-message-platforms";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import {
  WAHA_ACK_LABELS,
  wahaAckLevel,
} from "@/lib/waha/waha-message-ack";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProtocolEventDraft = ContactMessageProtocolEvent & {
  actorId?: string | null;
};

async function profileNamesByIds(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data } = await admin
    .from("profiles")
    .select("id, given_name, family_name")
    .in("id", ids);

  const map = new Map<string, string>();
  for (const p of data ?? []) {
    const label = [p.given_name, p.family_name]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
      .join(" ");
    if (label) map.set(p.id as string, label);
  }
  return map;
}

function platformLabel(platform: string): string {
  return (
    CONTACT_MESSAGE_PLATFORM_LABELS[
      platform as ContactMessagePlatform
    ] ?? platform
  );
}

function sortEvents(events: ContactMessageProtocolEvent[]): ContactMessageProtocolEvent[] {
  return [...events].sort((a, b) => {
    if (a.at && b.at) return a.at.localeCompare(b.at);
    if (a.at) return -1;
    if (b.at) return 1;
    return a.label.localeCompare(b.label, "de-DE");
  });
}

export async function loadContactMessageProtocol(
  admin: SupabaseClient,
  params: { restaurantId: string; messageId: string },
): Promise<
  | { data: ContactMessageProtocolPayload; error: null }
  | { data: null; error: string }
> {
  const { data: raw, error } = await admin
    .from("contact_messages")
    .select(
      `
      id,
      restaurant_id,
      contact_id,
      conversation_key,
      platform,
      direction,
      body,
      created_at,
      sent_by,
      sent_by_label,
      external_source_id,
      external_seen,
      waha_ack
    `,
    )
    .eq("id", params.messageId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!raw) return { data: null, error: "not_found" };

  const message = raw as {
    id: string;
    contact_id: string | null;
    conversation_key: string | null;
    platform: ContactMessagePlatform;
    direction: "inbound" | "outbound";
    body: string;
    created_at: string;
    sent_by: string | null;
    sent_by_label: string | null;
    external_source_id: string | null;
    external_seen: boolean | null;
    waha_ack: number | null;
  };

  const conversationKey = conversationThreadKeyFromRow({
    contact_id: message.contact_id,
    conversation_key: message.conversation_key,
  });
  if (!conversationKey) return { data: null, error: "not_found" };

  const displayPlatform = displayPlatformFromMessage(message);

  const drafts: ProtocolEventDraft[] = [];
  const actorIds: Array<string | null> = [message.sent_by];

  const outboundLabel = message.sent_by_label?.trim() || null;

  drafts.push({
    kind: "created",
    at: message.created_at,
    label:
      message.direction === "inbound"
        ? "Nachricht eingegangen"
        : "Nachricht erstellt",
    detail: platformLabel(displayPlatform),
    actorName:
      message.direction === "inbound"
        ? "Gast"
        : outboundLabel,
    actorId:
      message.direction === "outbound" && !outboundLabel
        ? message.sent_by
        : null,
  });

  const ext = message.external_source_id?.trim() ?? "";
  if (displayPlatform === "whatsapp" && message.direction === "outbound") {
    const ackLevel = wahaAckLevel(message.waha_ack);
    if (ackLevel !== "pending" && ackLevel !== "sent") {
      drafts.push({
        kind: "external_whatsapp",
        at: null,
        label: "WhatsApp-Zustellstatus",
        detail: WAHA_ACK_LABELS[ackLevel],
        actorName: null,
      });
    }
  }

  if (displayPlatform === "email" && message.direction === "inbound" && ext.startsWith("email-imap:")) {
    drafts.push({
      kind: "external_email",
      at: null,
      label: "E-Mail-Postfach",
      detail: message.external_seen
        ? "Am IMAP-Postfach als gelesen markiert"
        : "Am IMAP-Postfach noch ungelesen",
      actorName: null,
    });
  }

  const { data: reads } = await admin
    .from("contact_conversation_reads")
    .select("user_id, platform, last_read_at, marked_unread_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("conversation_key", conversationKey);

  const messageAt = new Date(message.created_at).getTime();

  for (const row of reads ?? []) {
    const userId = row.user_id as string;
    actorIds.push(userId);
    const platLabel = platformLabel(row.platform as string);
    const lastRead = row.last_read_at as string | null;
    const markedUnread = row.marked_unread_at as string | null;

    if (lastRead && new Date(lastRead).getTime() >= messageAt) {
      drafts.push({
        kind: "gwada_read",
        at: lastRead,
        label: "In Gwada gelesen",
        detail: platLabel,
        actorName: null,
        actorId: userId,
      });
    }

    if (
      markedUnread &&
      new Date(markedUnread).getTime() >= messageAt &&
      (!lastRead || new Date(markedUnread).getTime() > new Date(lastRead).getTime())
    ) {
      drafts.push({
        kind: "marked_unread",
        at: markedUnread,
        label: "Als ungelesen markiert",
        detail: platLabel,
        actorName: null,
        actorId: userId,
      });
    }
  }

  const names = await profileNamesByIds(
    admin,
    actorIds.filter((id): id is string => Boolean(id)),
  );
  const events: ContactMessageProtocolEvent[] = drafts.map(
    ({ actorId, ...event }) => ({
      ...event,
      actorName:
        event.actorName ??
        (actorId ? names.get(actorId) ?? null : null),
    }),
  );

  return {
    data: {
      messageId: message.id,
      platform: displayPlatform,
      direction: message.direction,
      preview: message.body.trim().slice(0, 120) || "—",
      events: sortEvents(events),
    },
    error: null,
  };
}
