import "server-only";

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
import { insertReservationLogEntry } from "@/lib/reservations/reservation-log-insert";
import { dispatchReservationEmail } from "@/lib/reservations/reservation-email-dispatch";
import {
  reservationDateTimeChanged,
  shouldRescheduleTimedOutbox,
} from "@/lib/reservations/reservation-datetime-reschedule";
import { dispatchReservationWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatReservationGuestLabel,
  type ReservationLogAction,
} from "@/lib/types/reservation-log";

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

async function logChangeRequestAction(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    reservationId: string;
    reservationNumber: number;
    guestFirstName: string;
    guestLastName: string;
    action: ReservationLogAction;
    before: ReservationLogSnapshot;
    after: ReservationLogSnapshot;
  },
) {
  const changes = buildReservationLogChanges(params.before, params.after);
  await insertReservationLogEntry(admin, {
    restaurantId: params.restaurantId,
    reservationId: params.reservationId,
    actorUserId: null,
    action: params.action,
    reservationNumber: params.reservationNumber,
    guestLabel: formatReservationGuestLabel(
      params.reservationNumber,
      params.guestFirstName,
      params.guestLastName,
    ),
    details: buildReservationLogDetails(changes, {
      actorSource: "display",
      summary:
        params.action === "change_request_declined"
          ? "Änderungsanfrage abgelehnt"
          : undefined,
    }),
  });
}

export async function approveDisplayReservationChangeRequest(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: loadErr } = await admin
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
    .eq("id", reservationId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!row) return { ok: false, error: "not_found" };

  const status = Array.isArray(row.reservation_statuses)
    ? row.reservation_statuses[0]
    : row.reservation_statuses;
  if (status?.code !== "change_requested") {
    return { ok: false, error: "no_change_request" };
  }

  const pending = parseReservationPendingChange(row.pending_change);
  if (!pending) return { ok: false, error: "pending_change_missing" };

  const restoreStatusId = row.status_before_change_id as string | null;
  const { data: restoreStatus } = restoreStatusId
    ? await admin
        .from("reservation_statuses")
        .select("id, name, code")
        .eq("id", restoreStatusId)
        .maybeSingle()
    : { data: null };

  const beforeSnapshot = snapshotFromRow(row, status?.name ?? "—", "Kein Tisch");
  const afterSnapshot = snapshotFromPending(
    pending,
    restoreStatus?.name ?? "—",
  );

  const { error } = await admin
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
    .eq("id", reservationId);

  if (error) return { ok: false, error: error.message };

  await logChangeRequestAction(admin, {
    restaurantId,
    reservationId,
    reservationNumber: row.reservation_number as number,
    guestFirstName: pending.guest_first_name,
    guestLastName: pending.guest_last_name,
    action: "change_request_approved",
    before: beforeSnapshot,
    after: afterSnapshot,
  });

  const restoreStatusCode = (restoreStatus?.code as string | undefined) ?? "";
  const datetimeChanged = reservationDateTimeChanged(
    {
      starts_at: row.starts_at as string,
      ends_at: row.ends_at as string,
    },
    { starts_at: pending.starts_at, ends_at: pending.ends_at },
  );
  if (shouldRescheduleTimedOutbox(restoreStatusCode, datetimeChanged)) {
    const notifyWhatsapp = pending.notify_whatsapp ?? Boolean(row.notify_whatsapp);
    const notifyEmail = pending.notify_email ?? Boolean(row.notify_email);
    if (notifyWhatsapp) {
      void dispatchReservationWhatsapp(admin, reservationId, "rescheduled").catch(
        () => undefined,
      );
    }
    if (notifyEmail) {
      void dispatchReservationEmail(admin, reservationId, "rescheduled").catch(
        () => undefined,
      );
    }
  }

  return { ok: true };
}

export async function declineDisplayReservationChangeRequest(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: loadErr } = await admin
    .from("reservations")
    .select(
      `id,
      reservation_number,
      guest_first_name,
      guest_last_name,
      status_before_change_id,
      ${RESERVATION_STATUS_EMBED} ( code )`,
    )
    .eq("id", reservationId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!row) return { ok: false, error: "not_found" };

  const status = Array.isArray(row.reservation_statuses)
    ? row.reservation_statuses[0]
    : row.reservation_statuses;
  if (status?.code !== "change_requested") {
    return { ok: false, error: "no_change_request" };
  }

  const restoreStatusId = row.status_before_change_id as string | null;
  const { error } = await admin
    .from("reservations")
    .update({
      status_id: restoreStatusId,
      pending_change: null,
      status_before_change_id: null,
    })
    .eq("id", reservationId);

  if (error) return { ok: false, error: error.message };

  await insertReservationLogEntry(admin, {
    restaurantId,
    reservationId,
    actorUserId: null,
    action: "change_request_declined",
    reservationNumber: row.reservation_number as number,
    guestLabel: formatReservationGuestLabel(
      row.reservation_number as number,
      row.guest_first_name as string,
      row.guest_last_name as string,
    ),
    details: buildReservationLogDetails([], {
      actorSource: "display",
      summary: "Änderungsanfrage abgelehnt",
    }),
  });

  return { ok: true };
}
