import {
  parseReservationPendingChange,
  type ReservationPendingChange,
} from "@/lib/reservations/reservation-pending-change";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";

export async function approveReservationChangeRequest(params: {
  restaurantId: string;
  reservationId: string;
}): Promise<{ error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.reservationId)
  ) {
    return { error: new Error("Ungültige ID.") };
  }
  const sb = createSupabaseBrowserClient();
  const { data: row, error: loadErr } = await sb
    .from("reservations")
    .select(
      `id, pending_change, status_before_change_id, ${RESERVATION_STATUS_EMBED} ( code )`,
    )
    .eq("id", params.reservationId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (loadErr) return { error: new Error(loadErr.message) };
  if (!row) return { error: new Error("Reservierung nicht gefunden.") };

  const status = Array.isArray(row.reservation_statuses)
    ? row.reservation_statuses[0]
    : row.reservation_statuses;
  if (status?.code !== "change_requested") {
    return { error: new Error("Keine offene Änderungsanfrage.") };
  }

  const pending = parseReservationPendingChange(row.pending_change);
  if (!pending) {
    return { error: new Error("Änderungsdaten fehlen.") };
  }

  const restoreStatusId = row.status_before_change_id as string | null;
  const { error } = await sb
    .from("reservations")
    .update({
      guest_first_name: pending.guest_first_name,
      guest_last_name: pending.guest_last_name,
      guest_phone: pending.guest_phone,
      guest_email: pending.guest_email,
      party_size: pending.party_size,
      starts_at: pending.starts_at,
      ends_at: pending.ends_at,
      dwell_minutes: pending.dwell_minutes,
      notify_email: pending.notify_email,
      notify_whatsapp: pending.notify_whatsapp,
      terms_accepted: pending.terms_accepted,
      status_id: restoreStatusId,
      pending_change: null,
      status_before_change_id: null,
    })
    .eq("id", params.reservationId);

  return { error: error ? new Error(error.message) : null };
}

export async function declineReservationChangeRequest(params: {
  restaurantId: string;
  reservationId: string;
}): Promise<{ error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.reservationId)
  ) {
    return { error: new Error("Ungültige ID.") };
  }
  const sb = createSupabaseBrowserClient();
  const { data: row, error: loadErr } = await sb
    .from("reservations")
    .select(`id, status_before_change_id, ${RESERVATION_STATUS_EMBED} ( code )`)
    .eq("id", params.reservationId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (loadErr) return { error: new Error(loadErr.message) };
  if (!row) return { error: new Error("Reservierung nicht gefunden.") };

  const status = Array.isArray(row.reservation_statuses)
    ? row.reservation_statuses[0]
    : row.reservation_statuses;
  if (status?.code !== "change_requested") {
    return { error: new Error("Keine offene Änderungsanfrage.") };
  }

  const restoreStatusId = row.status_before_change_id as string | null;
  const { error } = await sb
    .from("reservations")
    .update({
      status_id: restoreStatusId,
      pending_change: null,
      status_before_change_id: null,
    })
    .eq("id", params.reservationId);

  return { error: error ? new Error(error.message) : null };
}

export function reservationHasPendingChange(
  r: Pick<ReservationListRow, "pending_change" | "reservation_statuses">,
): boolean {
  if (r.reservation_statuses?.code === "change_requested") return true;
  return parseReservationPendingChange(r.pending_change) !== null;
}

export function getReservationPendingChange(
  r: Pick<ReservationListRow, "pending_change">,
): ReservationPendingChange | null {
  return parseReservationPendingChange(r.pending_change);
}
