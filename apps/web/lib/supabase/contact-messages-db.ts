import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ContactMessageDirection,
  ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import type { ConversationUnreadHint } from "@/lib/contact-messages/conversation-read-state";
import { buildContactConversationsFromRows } from "@/lib/contact-messages/build-contact-conversations";
import { CONVERSATION_LIST_MESSAGE_ROW_LIMIT } from "@/lib/contact-messages/conversation-list-limits";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { gwadaAttachmentDownloadUrl } from "@/lib/contact-messages/contact-message-attachment-urls";
import {
  fetchMessageAttachmentsForRestaurant,
  groupAttachmentsByMessageId,
  type RawMessageAttachmentRow,
} from "@/lib/contact-messages/fetch-message-attachments";
import {
  conversationThreadKeyFromRow,
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
  /** Reservierung der zuletzt sichtbaren Nachricht (für Vorschau-Link). */
  last_reservation_id?: string | null;
  /** Nur Gwada: eingehende Nachrichten in der Vorschau-Berechnung. */
  inbound_since_preview?: number;
  /** WAHA: letzte Aktivität war eine Reaction (Emoji in der Liste). */
  last_is_reaction?: boolean;
  /** Letzte Nachricht enthält Bild oder Datei (nicht bei Reactions). */
  last_attachment_kind?: ContactMessageAttachmentKind;
  /** Plattform der zuletzt sichtbaren Nachricht (Posteingang). */
  last_message_platform?: ContactMessagePlatform;
  /** Letzte Nachricht: kein separates Nachrichten-Alert (Reservierungs-Gastnachricht). */
  last_message_suppress_notifications?: boolean;
  /** Letzter eingehender Kanal des Gastes (Antwort-Default). */
  last_inbound_platform?: ContactMessagePlatform;
  /** Live-IMAP-Unread (vor Merge, für verknüpfte Kontakte). */
  email_unread_count?: number;
  /** Live-WAHA-Unread (vor Merge, für verknüpfte Kontakte). */
  whatsapp_unread_count?: number;
  /** Kanal neu vs. extern gelesen, in Gwada für diesen Nutzer noch offen. */
  unread_hint?: ConversationUnreadHint | null;
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
  external_source_id,
  external_seen,
  suppress_notifications
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

  const { data: reservation, error: reservationError } = await sb
    .from("reservations")
    .select("contact_id, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.reservationId)
    .maybeSingle();

  if (reservationError) {
    return { data: [], error: new Error(reservationError.message) };
  }

  const rawById = new Map<string, Record<string, unknown>>();

  const { data: linked, error: linkedError } = await sb
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("reservation_id", params.reservationId)
    .order("created_at", { ascending: true });

  if (linkedError) {
    return { data: [], error: new Error(linkedError.message) };
  }

  for (const row of linked ?? []) {
    const id = (row as { id: string }).id;
    rawById.set(id, row as Record<string, unknown>);
  }

  const contactId = (reservation?.contact_id as string | null) ?? null;
  const createdAt = reservation?.created_at as string | undefined;
  if (contactId && createdAt) {
    const windowStart = new Date(
      new Date(createdAt).getTime() - 2 * 60 * 1000,
    ).toISOString();
    const windowEnd = new Date(
      new Date(createdAt).getTime() + 15 * 60 * 1000,
    ).toISOString();

    const { data: orphans, error: orphanError } = await sb
      .from("contact_messages")
      .select(MESSAGE_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .eq("contact_id", contactId)
      .eq("direction", "inbound")
      .eq("platform", "gwada")
      .is("reservation_id", null)
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd)
      .order("created_at", { ascending: true });

    if (orphanError) {
      return { data: [], error: new Error(orphanError.message) };
    }

    for (const row of orphans ?? []) {
      const id = (row as { id: string }).id;
      if (!rawById.has(id)) {
        rawById.set(id, row as Record<string, unknown>);
      }
    }
  }

  const rawRows = [...rawById.values()].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );

  const enriched = await enrichMessageRowsWithAttachments(
    sb,
    params.restaurantId,
    rawRows,
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

  return {
    data: buildContactConversationsFromRows({
      platform: params.platform,
      rows: rawRows,
      attachmentsByMessage,
    }),
    error: null,
  };
}

export async function fetchContactMessagesQuick(
  restaurantId: string,
  contactId: string,
): Promise<{ data: ContactMessageRow[]; error: Error | null }> {
  return fetchContactMessages({ restaurantId, contactId });
}
