import "server-only";

import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Gast-Nachricht bei neuer Reservierung — kein separates Nachrichten-Alert. */
export function conversationExcludedFromSeparateMessageNotification(
  conversation: ContactConversationPreview,
): boolean {
  return (
    conversation.last_direction === "inbound" &&
    Boolean(conversation.last_reservation_id) &&
    conversation.last_message_suppress_notifications === true
  );
}

export async function fetchReservationGuestMessagePreviews(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    reservationIds: string[];
  },
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (params.reservationIds.length === 0) return map;

  const { data, error } = await sb
    .from("contact_messages")
    .select("reservation_id, body")
    .eq("restaurant_id", params.restaurantId)
    .in("reservation_id", params.reservationIds)
    .eq("direction", "inbound")
    .eq("platform", "gwada")
    .eq("suppress_notifications", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(
      "[gwada] reservation guest message previews",
      error.message,
    );
    return map;
  }

  for (const row of data ?? []) {
    const reservationId = (row as { reservation_id: string }).reservation_id;
    if (map.has(reservationId)) continue;
    const preview = (row as { body: string }).body?.trim();
    if (preview) map.set(reservationId, preview);
  }

  return map;
}
