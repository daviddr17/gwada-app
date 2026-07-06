import {
  parseReservationPendingChange,
  type ReservationPendingChange,
} from "@/lib/reservations/reservation-pending-change";
import {
  buildReservationLogChanges,
  buildReservationLogDetails,
  reservationSnapshotFromPayload,
  type ReservationLogSnapshot,
} from "@/lib/reservations/reservation-log-build";
import { insertReservationLogFromBrowser } from "@/lib/reservations/reservation-log-insert";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import {
  formatReservationGuestLabel,
  type ReservationLogAction,
} from "@/lib/types/reservation-log";

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
      `id,
      restaurant_id,
      reservation_number,
      guest_first_name,
      guest_last_name,
      guest_phone,
      guest_email,
      party_size,
      starts_at,
      ends_at,
      dwell_minutes,
      dining_table_id,
      notify_email,
      notify_whatsapp,
      terms_accepted,
      pending_change,
      status_before_change_id,
      ${RESERVATION_STATUS_EMBED} ( id, code, name, color_hex )`,
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
  const { data: restoreStatus } = restoreStatusId
    ? await sb
        .from("reservation_statuses")
        .select("id, name")
        .eq("id", restoreStatusId)
        .maybeSingle()
    : { data: null };

  const beforeSnapshot = snapshotFromRow(row, status?.name ?? "—", "Kein Tisch");
  const afterSnapshot = snapshotFromPending(pending, restoreStatus?.name ?? "—");

  const restoreStatusIdFinal = restoreStatusId;
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
      status_id: restoreStatusIdFinal,
      pending_change: null,
      status_before_change_id: null,
    })
    .eq("id", params.reservationId);

  if (error) return { error: new Error(error.message) };

  await logChangeRequestAction({
    restaurantId: params.restaurantId,
    reservationId: params.reservationId,
    reservationNumber: row.reservation_number as number,
    guestFirstName: pending.guest_first_name,
    guestLastName: pending.guest_last_name,
    action: "change_request_approved",
    before: beforeSnapshot,
    after: afterSnapshot,
  });

  return { error: null };
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
    .select(
      `id,
      reservation_number,
      guest_first_name,
      guest_last_name,
      status_before_change_id,
      ${RESERVATION_STATUS_EMBED} ( code )`,
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

  const restoreStatusId = row.status_before_change_id as string | null;
  const { error } = await sb
    .from("reservations")
    .update({
      status_id: restoreStatusId,
      pending_change: null,
      status_before_change_id: null,
    })
    .eq("id", params.reservationId);

  if (error) return { error: new Error(error.message) };

  await insertReservationLogFromBrowser({
    restaurantId: params.restaurantId,
    reservationId: params.reservationId,
    action: "change_request_declined",
    reservationNumber: row.reservation_number as number,
    guestLabel: formatReservationGuestLabel(
      row.reservation_number as number,
      row.guest_first_name as string,
      row.guest_last_name as string,
    ),
    details: buildReservationLogDetails([], {
      actorSource: "staff",
      summary: "Änderungsanfrage abgelehnt",
    }),
  });

  return { error: null };
}

function snapshotFromRow(
  row: Record<string, unknown>,
  statusName: string,
  tableLabel: string,
): ReservationLogSnapshot {
  return reservationSnapshotFromPayload(
    {
      guest_first_name: row.guest_first_name as string,
      guest_last_name: row.guest_last_name as string,
      guest_phone: (row.guest_phone as string | null) ?? null,
      guest_email: (row.guest_email as string | null) ?? null,
      party_size: row.party_size as number,
      starts_at: row.starts_at as string,
      ends_at: row.ends_at as string,
      status_id: "",
      dining_table_id: (row.dining_table_id as string | null) ?? null,
      dwell_minutes: (row.dwell_minutes as number | null) ?? null,
      notify_email: Boolean(row.notify_email),
      notify_whatsapp: Boolean(row.notify_whatsapp),
      terms_accepted: Boolean(row.terms_accepted),
    },
    statusName,
    tableLabel,
  );
}

function snapshotFromPending(
  pending: ReservationPendingChange,
  statusName: string,
): ReservationLogSnapshot {
  return reservationSnapshotFromPayload(
    {
      guest_first_name: pending.guest_first_name,
      guest_last_name: pending.guest_last_name,
      guest_phone: pending.guest_phone,
      guest_email: pending.guest_email,
      party_size: pending.party_size,
      starts_at: pending.starts_at,
      ends_at: pending.ends_at,
      status_id: "",
      dining_table_id: null,
      dwell_minutes: pending.dwell_minutes,
      notify_email: pending.notify_email,
      notify_whatsapp: pending.notify_whatsapp,
      terms_accepted: pending.terms_accepted,
    },
    statusName,
    "Kein Tisch",
  );
}

async function logChangeRequestAction(params: {
  restaurantId: string;
  reservationId: string;
  reservationNumber: number;
  guestFirstName: string;
  guestLastName: string;
  action: ReservationLogAction;
  before: ReservationLogSnapshot;
  after: ReservationLogSnapshot;
}) {
  const changes = buildReservationLogChanges(params.before, params.after);
  await insertReservationLogFromBrowser({
    restaurantId: params.restaurantId,
    reservationId: params.reservationId,
    action: params.action,
    reservationNumber: params.reservationNumber,
    guestLabel: formatReservationGuestLabel(
      params.reservationNumber,
      params.guestFirstName,
      params.guestLastName,
    ),
    details: buildReservationLogDetails(changes, { actorSource: "staff" }),
  });
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
