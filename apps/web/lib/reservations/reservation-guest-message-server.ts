import "server-only";

import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import type { SupabaseClient } from "@supabase/supabase-js";

const GUEST_MESSAGE_LINK_WINDOW_BEFORE_MS = 2 * 60 * 1000;
const GUEST_MESSAGE_LINK_WINDOW_AFTER_MS = 15 * 60 * 1000;

/** Eingehende Gast-Nachricht an Reservierung hängen (Display / Kiosk). */
export async function attachInboundGuestMessageToReservation(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    reservationId: string;
    guestMessage: string;
    restaurantName?: string | null;
  },
): Promise<void> {
  const body = params.guestMessage.trim();
  if (!body) return;

  const { data: reservation } = await admin
    .from("reservations")
    .select("contact_id, created_at")
    .eq("id", params.reservationId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (!reservation) return;

  let contactId = (reservation.contact_id as string | null) ?? null;
  if (!contactId) {
    const { data: retry } = await admin
      .from("reservations")
      .select("contact_id, created_at")
      .eq("id", params.reservationId)
      .maybeSingle();
    contactId = (retry?.contact_id as string | null) ?? null;
    if (retry?.created_at) {
      Object.assign(reservation, { created_at: retry.created_at });
    }
  }

  if (!contactId) {
    console.warn(
      "[gwada] reservation guest message skipped — no contact_id",
      params.reservationId,
    );
    return;
  }

  const createdAt = reservation.created_at as string;
  const windowStart = new Date(
    new Date(createdAt).getTime() - GUEST_MESSAGE_LINK_WINDOW_BEFORE_MS,
  ).toISOString();
  const windowEnd = new Date(
    new Date(createdAt).getTime() + GUEST_MESSAGE_LINK_WINDOW_AFTER_MS,
  ).toISOString();

  await admin
    .from("contact_messages")
    .update({ reservation_id: params.reservationId })
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", contactId)
    .eq("direction", "inbound")
    .eq("platform", "gwada")
    .is("reservation_id", null)
    .gte("created_at", windowStart)
    .lte("created_at", windowEnd);

  const { data: linked } = await admin
    .from("contact_messages")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("reservation_id", params.reservationId)
    .eq("direction", "inbound")
    .eq("platform", "gwada")
    .limit(1);

  if (linked?.length) return;

  const result = await sendContactMessageServer(admin, {
    restaurantId: params.restaurantId,
    contactId,
    body,
    direction: "inbound",
    channels: ["gwada"],
    reservationId: params.reservationId,
    restaurantName: params.restaurantName ?? null,
    suppressNotifications: true,
  });

  if (!result.ok) {
    console.warn(
      "[gwada] reservation guest message insert",
      params.reservationId,
      result.errors,
    );
  }
}
