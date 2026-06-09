import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ContactMessageDirection,
  ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { contactDisplayName } from "@/lib/supabase/contacts-db";
import { gwadaAttachmentDownloadUrl } from "@/lib/contact-messages/contact-message-attachment-urls";
import {
  fetchMessageAttachmentsForRestaurant,
  groupAttachmentsByMessageId,
  type RawMessageAttachmentRow,
} from "@/lib/contact-messages/fetch-message-attachments";
import { primaryAttachmentKind } from "@/lib/contact-messages/last-attachment-kind";
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
};

const MESSAGE_SELECT = `
  id,
  restaurant_id,
  contact_id,
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

function mapMessageRow(
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
    mapMessageRow(row, byMessage.get(row.id as string) ?? []),
  );
}

export async function fetchContactMessages(params: {
  restaurantId: string;
  contactId: string;
  platform?: ContactMessagePlatform;
}): Promise<{ data: ContactMessageRow[]; error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.contactId)
  ) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .order("created_at", { ascending: true });

  if (params.platform && params.platform !== "gwada") {
    q = q.eq("platform", params.platform);
  }

  const { data, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };
  const enriched = await enrichMessageRowsWithAttachments(
    sb,
    params.restaurantId,
    (data ?? []) as Record<string, unknown>[],
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
    .order("created_at", { ascending: false });

  if (params.platform !== "gwada") {
    q = q.eq("platform", params.platform);
  }

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
  const previews = new Map<string, ContactConversationPreview>();
  const lastInboundByContact = new Map<string, ContactMessagePlatform>();

  for (const raw of rawRows) {
    const row = raw as Record<string, unknown>;
    const contactId = row.contact_id as string;
    countByContact.set(contactId, (countByContact.get(contactId) ?? 0) + 1);
    if (row.reservation_id) {
      hasReservationByContact.set(contactId, true);
    }

    const mapped = mapMessageRow(
      row,
      attachmentsByMessage.get(row.id as string) ?? [],
    );
    const msgPlatform = messageDisplayPlatform(mapped);
    if (
      mapped.direction === "inbound" &&
      !lastInboundByContact.has(contactId)
    ) {
      lastInboundByContact.set(contactId, msgPlatform);
    }

    if (previews.has(contactId)) continue;

    const contactRaw = row.contacts;
    const contact = Array.isArray(contactRaw)
      ? (contactRaw[0] as { first_name: string; last_name: string })
      : (contactRaw as { first_name: string; last_name: string } | null);
    if (!contact) continue;

    previews.set(contactId, {
      contact_id: contactId,
      contact_name: contactDisplayName(contact),
      platform: params.platform,
      last_body: mapped.body.trim(),
      last_at: mapped.created_at,
      last_direction: mapped.direction,
      message_count: 0,
      unread_count: 0,
      is_unread: false,
      has_reservation_link: false,
      inbound_since_preview: mapped.direction === "inbound" ? 1 : 0,
      last_attachment_kind: primaryAttachmentKind(
        mapped.attachments?.map((a) => a.kind),
      ),
      last_message_platform: msgPlatform,
    });
  }

  for (const [contactId, preview] of previews) {
    preview.message_count = countByContact.get(contactId) ?? 0;
    preview.has_reservation_link =
      hasReservationByContact.get(contactId) ?? false;
    preview.last_inbound_platform = lastInboundByContact.get(contactId);
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
