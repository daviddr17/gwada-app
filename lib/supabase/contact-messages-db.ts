import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ContactMessageDirection,
  ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { contactDisplayName } from "@/lib/supabase/contacts-db";

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
  reservation_id: string | null;
  sent_by: string | null;
  delivery_status: string;
  created_at: string;
  send_batch_id?: string | null;
  external_source_id?: string | null;
  /** WAHA-Nachrichten-ID (ohne `waha:`-Präfix) für Reactions. */
  waha_message_id?: string | null;
  reactions?: ContactMessageReaction[];
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
  return { data: (data ?? []) as ContactMessageRow[], error: null };
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
  return { data: (data ?? []) as ContactMessageRow[], error: null };
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

  const countByContact = new Map<string, number>();
  const hasReservationByContact = new Map<string, boolean>();
  const previews = new Map<string, ContactConversationPreview>();

  for (const raw of messages ?? []) {
    const row = raw as Record<string, unknown>;
    const contactId = row.contact_id as string;
    countByContact.set(contactId, (countByContact.get(contactId) ?? 0) + 1);
    if (row.reservation_id) {
      hasReservationByContact.set(contactId, true);
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
      last_body: (row.body as string).trim(),
      last_at: row.created_at as string,
      last_direction: row.direction as ContactMessageDirection,
      message_count: 0,
      unread_count: 0,
      is_unread: false,
      has_reservation_link: false,
      inbound_since_preview:
        row.direction === "inbound" ? 1 : 0,
    });
  }

  for (const [contactId, preview] of previews) {
    preview.message_count = countByContact.get(contactId) ?? 0;
    preview.has_reservation_link =
      hasReservationByContact.get(contactId) ?? false;
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
