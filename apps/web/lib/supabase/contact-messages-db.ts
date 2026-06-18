import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ContactMessageDirection,
  ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import { countsTowardGwadaUnread } from "@/lib/contact-messages/conversation-read-state";
import { CONVERSATION_LIST_MESSAGE_ROW_LIMIT } from "@/lib/contact-messages/conversation-list-limits";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { contactDisplayName } from "@/lib/supabase/contacts-db";
import { gwadaAttachmentDownloadUrl } from "@/lib/contact-messages/contact-message-attachment-urls";
import {
  fetchMessageAttachmentsForRestaurant,
  groupAttachmentsByMessageId,
  type RawMessageAttachmentRow,
} from "@/lib/contact-messages/fetch-message-attachments";
import { primaryAttachmentKind } from "@/lib/contact-messages/last-attachment-kind";
import { previewBodyAndKindFromWhatsappMirror } from "@/lib/contact-messages/whatsapp-mirror-preview";
import {
  conversationThreadKeyFromRow,
  defaultConversationLabel,
} from "@/lib/contact-messages/conversation-thread-key";
import type {
  ContactMessageAttachment,
  ContactMessageAttachmentKind,
} from "@/lib/types/contact-message-attachment";

export type ContactMessageReaction = {
  emoji: string;
  fromMe: boolean;
  senderId?: string;
};

export type ContactMessageRow = {
  id: string;
  restaurant_id: string;
  contact_id: string;
  platform: ContactMessagePlatform;
  direction: ContactMessageDirection;
  body: string;
  /** HTML-Inhalt für E-Mail-Nachrichten (IMAP); Anzeige isoliert im iframe. */
  body_html?: string | null;
  reservation_id: string | null;
  sent_by: string | null;
  delivery_status: string;
  created_at: string;
  send_batch_id?: string | null;
  external_source_id?: string | null;
  /** WAHA-Nachrichten-ID (ohne `waha:`-Präfix) für Reactions. */
  waha_message_id?: string | null;
  /** Meta Graph Message-ID für Messenger/Instagram Reactions. */
  meta_message_id?: string | null;
  /** WAHA ACK (1 gesendet, 2 zugestellt, 3 gelesen, 4 abgespielt). */
  waha_ack?: number | null;
  reactions?: ContactMessageReaction[];
  attachments?: ContactMessageAttachment[];
};

export type ContactConversationPreview = {
  contact_id: string;
  contact_name: string;
  platform: ContactMessagePlatform;
  last_body: string;
  last_at: string;
  last_direction: ContactMessageDirection;
  /** Gesamtanzahl Nachrichten in der Konversation (Gwada-DB). */
  message_count: number;
  /** Ungelesene Nachrichten (WAHA-Count oder berechnet). */
  unread_count: number;
  is_unread: boolean;
  has_reservation_link: boolean;
  /** Nur Gwada: eingehende Nachrichten in der Vorschau-Berechnung. */
  inbound_since_preview?: number;
  /** WAHA: letzte Aktivität war eine Reaction (Emoji in der Liste). */
  last_is_reaction?: boolean;
  /** Letzte Nachricht enthält Bild oder Datei (nicht bei Reactions). */
  last_attachment_kind?: ContactMessageAttachmentKind;
  /** Plattform der zuletzt sichtbaren Nachricht (Posteingang). */
  last_message_platform?: ContactMessagePlatform;
  /** Letzter eingehender Kanal des Gastes (Antwort-Default). */
  last_inbound_platform?: ContactMessagePlatform;
  /** Live-IMAP-Unread (vor Merge, für verknüpfte Kontakte). */
  email_unread_count?: number;
  /** Live-WAHA-Unread (vor Merge, für verknüpfte Kontakte). */
  whatsapp_unread_count?: number;
};

const MESSAGE_SELECT = `
  id,
  restaurant_id,
  contact_id,
  conversation_key,
  conversation_label,
  platform,
  direction,
  body,
  reservation_id,
  sent_by,
  delivery_status,
  created_at,
  send_batch_id,
  external_source_id
`;

export function mapContactMessageRowFromRecord(
  raw: Record<string, unknown>,
  attachmentRows: RawMessageAttachmentRow[] = [],
): ContactMessageRow {
  const restaurantId = raw.restaurant_id as string;
  const messageId = raw.id as string;
  const attachments: ContactMessageAttachment[] = attachmentRows.map((a) => ({
    id: a.id,
    kind: a.kind === "image" ? "image" : "file",
    fileName: a.file_name,
    mimeType: a.mime_type,
    byteSize: a.byte_size,
    url: gwadaAttachmentDownloadUrl({
      restaurantId,
      messageId,
      attachmentId: a.id,
    }),
  }));

  return {
    ...(raw as ContactMessageRow),
    contact_id: conversationThreadKeyFromRow({
      contact_id: raw.contact_id as string | null,
      conversation_key: raw.conversation_key as string | null,
    }),
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

async function enrichMessageRowsWithAttachments(
  sb: ReturnType<typeof createSupabaseBrowserClient>,
  restaurantId: string,
  rows: Record<string, unknown>[],
): Promise<ContactMessageRow[]> {
  if (rows.length === 0) return [];
  const messageIds = rows.map((r) => r.id as string);
  const { data: attachmentRows, error: attErr } =
    await fetchMessageAttachmentsForRestaurant(sb, {
      restaurantId,
      messageIds,
    });
  const byMessage = attErr
    ? new Map<string, RawMessageAttachmentRow[]>()
    : groupAttachmentsByMessageId(attachmentRows);
  return rows.map((row) =>
    mapContactMessageRowFromRecord(row, byMessage.get(row.id as string) ?? []),
  );
}

/** Max. DB-Nachrichten pro Thread-Ladevorgang (ältere über Pagination später). */
export const CONTACT_MESSAGES_THREAD_DB_LIMIT = 300;

export async function fetchContactMessages(params: {
  restaurantId: string;
  contactId: string;
  platform?: ContactMessagePlatform;
  /** Max. Zeilen (neueste zuerst geladen, chronologisch zurückgegeben). */
  limit?: number;
}): Promise<{ data: ContactMessageRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: [], error: null };
  }
  const limit = params.limit ?? CONTACT_MESSAGES_THREAD_DB_LIMIT;
  const sb = createSupabaseBrowserClient();

  let q = sb
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.contactId.includes(":")) {
    q = q.eq("conversation_key", params.contactId);
  } else if (isUuidRestaurantId(params.contactId)) {
    q = q.eq("contact_id", params.contactId);
  } else {
    return { data: [], error: null };
  }

  if (params.platform && params.platform !== "gwada") {
    q = q.eq("platform", params.platform);
  }

  const { data, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };
  const rows = [...((data ?? []) as Record<string, unknown>[])].reverse();
  const enriched = await enrichMessageRowsWithAttachments(
    sb,
    params.restaurantId,
    rows,
  );
  return { data: enriched, error: null };
}

export async function fetchReservationContactMessages(params: {
  restaurantId: string;
  reservationId: string;
}): Promise<{ data: ContactMessageRow[]; error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.reservationId)
  ) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("reservation_id", params.reservationId)
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  const enriched = await enrichMessageRowsWithAttachments(
    sb,
    params.restaurantId,
    (data ?? []) as Record<string, unknown>[],
  );
  return { data: enriched, error: null };
}

export async function fetchContactMessageCountsByContact(
  restaurantId: string,
  contactIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!isUuidRestaurantId(restaurantId) || contactIds.length === 0) {
    return map;
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contact_messages")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .in("contact_id", contactIds);

  if (error) return map;
  for (const row of data ?? []) {
    const cid = (row as { contact_id: string }).contact_id;
    map.set(cid, (map.get(cid) ?? 0) + 1);
  }
  return map;
}

export async function fetchContactConversations(params: {
  restaurantId: string;
  platform: ContactMessagePlatform;
}): Promise<{ data: ContactConversationPreview[]; error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();

  let q = sb
    .from("contact_messages")
    .select(
      `
      ${MESSAGE_SELECT},
      contacts ( first_name, last_name )
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", params.platform)
    .order("created_at", { ascending: false })
    .limit(CONVERSATION_LIST_MESSAGE_ROW_LIMIT);

  const { data: messages, error: msgErr } = await q;

  if (msgErr) return { data: [], error: new Error(msgErr.message) };

  const rawRows = (messages ?? []) as Record<string, unknown>[];
  const { data: attachmentRows, error: attErr } =
    await fetchMessageAttachmentsForRestaurant(sb, {
      restaurantId: params.restaurantId,
      messageIds: rawRows.map((r) => r.id as string),
    });
  const attachmentsByMessage = attErr
    ? new Map<string, RawMessageAttachmentRow[]>()
    : groupAttachmentsByMessageId(attachmentRows);

  const countByContact = new Map<string, number>();
  const hasReservationByContact = new Map<string, boolean>();
  const inboundAfter = new Map<string, number>();
  const previews = new Map<string, ContactConversationPreview>();
  const lastInboundByContact = new Map<string, ContactMessagePlatform>();

  for (const raw of rawRows) {
    const row = raw as Record<string, unknown>;
    const threadKey = conversationThreadKeyFromRow({
      contact_id: row.contact_id as string | null,
      conversation_key: row.conversation_key as string | null,
    });
    if (!threadKey) continue;

    countByContact.set(threadKey, (countByContact.get(threadKey) ?? 0) + 1);
    if (row.reservation_id) {
      hasReservationByContact.set(threadKey, true);
    }

    const mapped = mapContactMessageRowFromRecord(
      row,
      attachmentsByMessage.get(row.id as string) ?? [],
    );
    const msgPlatform = messageDisplayPlatform(mapped);
    const ext = (mapped.external_source_id as string | null) ?? "";
    if (
      countsTowardGwadaUnread({
        direction: mapped.direction,
        externalSourceId: ext || null,
      })
    ) {
      inboundAfter.set(threadKey, (inboundAfter.get(threadKey) ?? 0) + 1);
    }
    if (
      mapped.direction === "inbound" &&
      !lastInboundByContact.has(threadKey)
    ) {
      lastInboundByContact.set(threadKey, msgPlatform);
    }

    if (previews.has(threadKey)) continue;

    const contactRaw = row.contacts;
    const contact = Array.isArray(contactRaw)
      ? (contactRaw[0] as { first_name: string; last_name: string })
      : (contactRaw as { first_name: string; last_name: string } | null);

    const conversationKey = row.conversation_key as string | null;
    const contactName = contact
      ? contactDisplayName(contact)
      : (row.conversation_label as string | null)?.trim() ||
        (conversationKey ? defaultConversationLabel(conversationKey) : "Chat");

    const mirrored =
      ext.startsWith("waha:") || msgPlatform === "whatsapp"
        ? previewBodyAndKindFromWhatsappMirror(mapped.body.trim())
        : { body: mapped.body.trim(), attachmentKind: undefined as ContactMessageAttachmentKind | undefined };

    previews.set(threadKey, {
      contact_id: threadKey,
      contact_name: contactName,
      platform: params.platform,
      last_body: mirrored.body,
      last_at: mapped.created_at,
      last_direction: mapped.direction,
      message_count: 0,
      unread_count: 0,
      is_unread: false,
      has_reservation_link: false,
      inbound_since_preview: inboundAfter.get(threadKey) ?? 0,
      last_attachment_kind:
        primaryAttachmentKind(mapped.attachments?.map((a) => a.kind)) ??
        mirrored.attachmentKind,
      last_message_platform: msgPlatform,
    });
  }

  for (const [threadKey, preview] of previews) {
    preview.message_count = countByContact.get(threadKey) ?? 0;
    preview.inbound_since_preview = inboundAfter.get(threadKey) ?? 0;
    preview.has_reservation_link =
      hasReservationByContact.get(threadKey) ?? false;
    preview.last_inbound_platform = lastInboundByContact.get(threadKey);
  }

  const list = [...previews.values()].sort((a, b) =>
    b.last_at.localeCompare(a.last_at),
  );
  return { data: list, error: null };
}

export async function fetchContactMessagesQuick(
  restaurantId: string,
  contactId: string,
): Promise<{ data: ContactMessageRow[]; error: Error | null }> {
  return fetchContactMessages({ restaurantId, contactId });
}
