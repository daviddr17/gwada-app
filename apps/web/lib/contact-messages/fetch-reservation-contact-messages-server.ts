import "server-only";

import {
  fetchMessageAttachmentsForRestaurant,
  groupAttachmentsByMessageId,
  type RawMessageAttachmentRow,
} from "@/lib/contact-messages/fetch-message-attachments";
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
    .select("contact_id, created_at")
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

    const { data: orphans, error: orphanError } = await client
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
      return { data: [], error: orphanError.message };
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

  const enriched = await enrichMessageRows(
    client,
    params.restaurantId,
    rawRows,
  );

  return { data: enriched, error: null };
}
