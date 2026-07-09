import "server-only";

import {
  fetchMessageAttachmentsForRestaurant,
  groupAttachmentsByMessageId,
  type RawMessageAttachmentRow,
} from "@/lib/contact-messages/fetch-message-attachments";
import {
  mergeMessageRowsById,
  reservationGuestThreadKeys,
} from "@/lib/contact-messages/reservation-message-thread-keys";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { resolveContactIdByGuestIdentity } from "@/lib/contacts/contact-identity-resolver";
import {
  mapContactMessageRowFromRecord,
  type ContactMessageRow,
} from "@/lib/supabase/contact-messages-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

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

async function enrichMessageRows(
  client: SupabaseClient,
  restaurantId: string,
  rows: Record<string, unknown>[],
): Promise<ContactMessageRow[]> {
  if (rows.length === 0) return [];
  const messageIds = rows.map((r) => r.id as string);
  const { data: attachmentRows, error: attErr } =
    await fetchMessageAttachmentsForRestaurant(client, {
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

async function fetchRawMessagesForThreadKey(
  client: SupabaseClient,
  restaurantId: string,
  threadKey: string,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  let q = client
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (isLinkedContactId(threadKey)) {
    q = q.eq("contact_id", threadKey);
  } else {
    q = q.eq("conversation_key", threadKey);
  }

  const { data, error } = await q;
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as Record<string, unknown>[], error: null };
}

/** Reservierungs-Nachrichten (Server/Display) — gleiche Logik wie Browser-Client. */
export async function fetchReservationContactMessagesServer(
  client: SupabaseClient,
  params: { restaurantId: string; reservationId: string },
): Promise<{ data: ContactMessageRow[]; error: string | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.reservationId)
  ) {
    return { data: [], error: null };
  }

  const { data: reservation, error: reservationError } = await client
    .from("reservations")
    .select("contact_id, created_at, guest_email, guest_phone")
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.reservationId)
    .maybeSingle();

  if (reservationError) {
    return { data: [], error: reservationError.message };
  }

  const rawById = new Map<string, Record<string, unknown>>();

  const { data: linked, error: linkedError } = await client
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("reservation_id", params.reservationId)
    .order("created_at", { ascending: true });

  if (linkedError) {
    return { data: [], error: linkedError.message };
  }

  mergeMessageRowsById(rawById, (linked ?? []) as Record<string, unknown>[]);

  let linkedContactId = (reservation?.contact_id as string | null) ?? null;
  if (!linkedContactId) {
    linkedContactId = await resolveContactIdByGuestIdentity(client, {
      restaurantId: params.restaurantId,
      guestPhone: (reservation?.guest_phone as string | null) ?? null,
      guestEmail: (reservation?.guest_email as string | null) ?? null,
    });
  }

  const threadKeys = reservationGuestThreadKeys({
    guestEmail: (reservation?.guest_email as string | null) ?? null,
    guestPhone: (reservation?.guest_phone as string | null) ?? null,
    linkedContactId,
  });

  for (const threadKey of threadKeys) {
    const { rows, error } = await fetchRawMessagesForThreadKey(
      client,
      params.restaurantId,
      threadKey,
    );
    if (error) {
      return { data: [], error };
    }
    mergeMessageRowsById(rawById, rows);
  }

  const rawRows = [...rawById.values()].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );

  const enriched = await enrichMessageRows(
    client,
    params.restaurantId,
    rawRows,
  );

  return { data: enriched, error: null };
}
