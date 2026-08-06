import "server-only";

import {
  updateDisplayReservationStatus,
  updateDisplayReservationTable,
} from "@/lib/display/display-reservation-mutations-server";
import { openPosTableSession } from "@/lib/pos/pos-order-server";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SeatPosReservationParams = {
  supabase: SupabaseClient;
  restaurantId: string;
  reservationId: string;
  diningTableId: string;
  coverCount?: number;
  openedByProfileId: string | null;
  /** `restaurant_staff.id` when PIN session; enables display mutation helpers. */
  staffId?: string | null;
};

export type SeatPosReservationResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string; status: number };

/**
 * Open a POS table session linked to a confirmed reservation and mark it seated.
 * Idempotent when an open session already has `reservation_id`.
 */
export async function seatPosReservation(
  params: SeatPosReservationParams,
): Promise<SeatPosReservationResult> {
  const reservationId = params.reservationId.trim();
  const diningTableId = params.diningTableId.trim();
  if (!reservationId) {
    return { ok: false, error: "invalid_reservation_id", status: 400 };
  }
  if (!diningTableId) {
    return { ok: false, error: "invalid_dining_table_id", status: 400 };
  }

  const admin = createSupabaseAdminClient() ?? params.supabase;

  const { data: linkedOpen } = await admin
    .from("pos_table_sessions")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("reservation_id", reservationId)
    .eq("status", "open")
    .maybeSingle();

  if (linkedOpen?.id) {
    const mark = await markReservationSeatedAtTable({
      admin,
      restaurantId: params.restaurantId,
      reservationId,
      diningTableId,
      staffId: params.staffId ?? null,
      allowAlreadySeated: true,
    });
    if (!mark.ok && mark.error !== "invalid_status") {
      return mark;
    }
    return { ok: true, sessionId: linkedOpen.id as string };
  }

  const { data: reservation, error: loadError } = await admin
    .from("reservations")
    .select(
      `
      id,
      restaurant_id,
      dining_table_id,
      ${RESERVATION_STATUS_EMBED} ( id, code )
    `,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (loadError) {
    return { ok: false, error: loadError.message, status: 500 };
  }
  if (!reservation || reservation.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "reservation_not_found", status: 404 };
  }

  const statusRaw = (reservation as Record<string, unknown>).reservation_statuses;
  const statusOne = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  const statusCode =
    statusOne && typeof statusOne === "object" && "code" in statusOne
      ? String((statusOne as { code: string }).code)
      : "";

  if (statusCode !== "confirmed") {
    return { ok: false, error: "invalid_status", status: 400 };
  }

  const { data: existingOpen } = await admin
    .from("pos_table_sessions")
    .select("id, reservation_id")
    .eq("dining_table_id", diningTableId)
    .eq("status", "open")
    .maybeSingle();

  if (existingOpen) {
    if ((existingOpen.reservation_id as string | null) === reservationId) {
      return { ok: true, sessionId: existingOpen.id as string };
    }
    return { ok: false, error: "table_occupied", status: 409 };
  }

  const opened = await openPosTableSession({
    supabase: params.supabase,
    restaurantId: params.restaurantId,
    diningTableId,
    coverCount: params.coverCount,
    openedByProfileId: params.openedByProfileId,
    reservationId,
  });

  if (!opened.ok) {
    return opened;
  }

  // Race: openPosTableSession may return an unrelated open session.
  const { data: sessionRow } = await admin
    .from("pos_table_sessions")
    .select("id, reservation_id, dining_table_id")
    .eq("id", opened.sessionId)
    .maybeSingle();

  if (
    sessionRow &&
    (sessionRow.reservation_id as string | null) !== reservationId &&
    (sessionRow.dining_table_id as string) === diningTableId
  ) {
    return { ok: false, error: "table_occupied", status: 409 };
  }

  const mark = await markReservationSeatedAtTable({
    admin,
    restaurantId: params.restaurantId,
    reservationId,
    diningTableId,
    staffId: params.staffId ?? null,
    allowAlreadySeated: false,
  });
  if (!mark.ok) {
    return mark;
  }

  return { ok: true, sessionId: opened.sessionId };
}

async function markReservationSeatedAtTable(params: {
  admin: SupabaseClient;
  restaurantId: string;
  reservationId: string;
  diningTableId: string;
  staffId: string | null;
  allowAlreadySeated: boolean;
}): Promise<SeatPosReservationResult | { ok: true }> {
  const { data: seatedStatus } = await params.admin
    .from("reservation_statuses")
    .select("id")
    .eq("code", "seated")
    .maybeSingle();

  const seatedStatusId = seatedStatus?.id as string | undefined;
  if (!seatedStatusId) {
    return { ok: false, error: "seated_status_missing", status: 500 };
  }

  const staffId = params.staffId?.trim() || "";
  if (staffId) {
    const tableResult = await updateDisplayReservationTable(
      params.admin,
      params.restaurantId,
      staffId,
      params.reservationId,
      params.diningTableId,
    );
    if (!tableResult.ok) {
      if (tableResult.error === "not_found") {
        return { ok: false, error: "reservation_not_found", status: 404 };
      }
      if (tableResult.error === "table_requires_confirmed") {
        if (!params.allowAlreadySeated) {
          return { ok: false, error: "invalid_status", status: 400 };
        }
      } else {
        return { ok: false, error: tableResult.error, status: 500 };
      }
    }

    const statusResult = await updateDisplayReservationStatus(
      params.admin,
      params.restaurantId,
      staffId,
      params.reservationId,
      seatedStatusId,
    );
    if (!statusResult.ok) {
      if (statusResult.error === "not_found") {
        return { ok: false, error: "reservation_not_found", status: 404 };
      }
      return { ok: false, error: statusResult.error, status: 500 };
    }
    return { ok: true };
  }

  // Bearer / device auth without restaurant_staff id — update directly.
  const { data: reservation } = await params.admin
    .from("reservations")
    .select(`id, restaurant_id, ${RESERVATION_STATUS_EMBED} ( code )`)
    .eq("id", params.reservationId)
    .maybeSingle();

  if (!reservation || reservation.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "reservation_not_found", status: 404 };
  }

  const statusRaw = (reservation as Record<string, unknown>).reservation_statuses;
  const statusOne = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  const statusCode =
    statusOne && typeof statusOne === "object" && "code" in statusOne
      ? String((statusOne as { code: string }).code)
      : "";

  if (statusCode !== "confirmed" && !(params.allowAlreadySeated && statusCode === "seated")) {
    return { ok: false, error: "invalid_status", status: 400 };
  }

  const { error } = await params.admin
    .from("reservations")
    .update({
      status_id: seatedStatusId,
      dining_table_id: params.diningTableId,
    })
    .eq("id", params.reservationId)
    .eq("restaurant_id", params.restaurantId);

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  return { ok: true };
}
