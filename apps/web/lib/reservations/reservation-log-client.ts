import {
  buildReservationLogChanges,
  buildReservationLogDetails,
  reservationSnapshotFromPayload,
  type ReservationLogSnapshot,
} from "@/lib/reservations/reservation-log-build";
import { insertReservationLogFromBrowser } from "@/lib/reservations/reservation-log-insert";
import { formatDiningTableLabel, type DiningTableRow } from "@/lib/supabase/dining-floor-db";
import type {
  ReservationListRow,
  ReservationStatusJoin,
  ReservationUpdatePayload,
} from "@/lib/supabase/reservations-db";
import {
  formatReservationGuestLabel,
  type ReservationLogAction,
} from "@/lib/types/reservation-log";

function statusNameById(
  statuses: readonly ReservationStatusJoin[],
  statusId: string,
): string {
  return statuses.find((s) => s.id === statusId)?.name ?? "—";
}

function tableLabelById(
  tables: readonly DiningTableRow[],
  tableId: string | null,
): string {
  if (!tableId) return "Kein Tisch";
  const table = tables.find((t) => t.id === tableId);
  return table ? formatDiningTableLabel(table) : "—";
}

export function reservationSnapshotFromListRow(
  row: ReservationListRow,
  statuses: readonly ReservationStatusJoin[],
  tables: readonly DiningTableRow[],
): ReservationLogSnapshot {
  return reservationSnapshotFromPayload(
    {
      guest_first_name: row.guest_first_name,
      guest_last_name: row.guest_last_name,
      guest_phone: row.guest_phone,
      guest_email: row.guest_email,
      party_size: row.party_size,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status_id: row.reservation_statuses?.id ?? "",
      dining_table_id: row.dining_table_id,
      dwell_minutes: row.dwell_minutes,
      notify_email: row.notify_email,
      notify_whatsapp: row.notify_whatsapp,
      terms_accepted: row.terms_accepted,
    },
    row.reservation_statuses?.name ?? statusNameById(statuses, row.reservation_statuses?.id ?? ""),
    row.dining_tables
      ? formatDiningTableLabel({
          table_number: row.dining_tables.table_number,
          table_name: row.dining_tables.table_name,
        })
      : tableLabelById(tables, row.dining_table_id),
  );
}

export async function logReservationMutationFromBrowser(params: {
  restaurantId: string;
  reservationId: string;
  reservationNumber: number;
  guestFirstName: string;
  guestLastName: string;
  action: ReservationLogAction;
  before: ReservationLogSnapshot | null;
  after: ReservationLogSnapshot;
}): Promise<void> {
  const changes = buildReservationLogChanges(params.before, params.after);
  if (params.action === "updated" && changes.length === 0) return;

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

export async function logReservationCreateFromBrowser(params: {
  restaurantId: string;
  reservationId: string;
  reservationNumber: number;
  guestFirstName: string;
  guestLastName: string;
  payload: ReservationUpdatePayload;
  statuses: readonly ReservationStatusJoin[];
  tables: readonly DiningTableRow[];
}): Promise<void> {
  const after = reservationSnapshotFromPayload(
    params.payload,
    statusNameById(params.statuses, params.payload.status_id),
    tableLabelById(params.tables, params.payload.dining_table_id),
  );
  await logReservationMutationFromBrowser({
    restaurantId: params.restaurantId,
    reservationId: params.reservationId,
    reservationNumber: params.reservationNumber,
    guestFirstName: params.guestFirstName,
    guestLastName: params.guestLastName,
    action: "created",
    before: null,
    after,
  });
}

export async function logReservationUpdateFromBrowser(params: {
  reservation: ReservationListRow;
  payload: ReservationUpdatePayload;
  statuses: readonly ReservationStatusJoin[];
  tables: readonly DiningTableRow[];
}): Promise<void> {
  const before = reservationSnapshotFromListRow(
    params.reservation,
    params.statuses,
    params.tables,
  );
  const after = reservationSnapshotFromPayload(
    params.payload,
    statusNameById(params.statuses, params.payload.status_id),
    tableLabelById(params.tables, params.payload.dining_table_id),
  );
  await logReservationMutationFromBrowser({
    restaurantId: params.reservation.restaurant_id,
    reservationId: params.reservation.id,
    reservationNumber: params.reservation.reservation_number,
    guestFirstName: params.payload.guest_first_name,
    guestLastName: params.payload.guest_last_name,
    action: "updated",
    before,
    after,
  });
}

export async function logReservationDeleteFromBrowser(
  reservation: ReservationListRow,
): Promise<void> {
  await insertReservationLogFromBrowser({
    restaurantId: reservation.restaurant_id,
    reservationId: reservation.id,
    action: "deleted",
    reservationNumber: reservation.reservation_number,
    guestLabel: formatReservationGuestLabel(
      reservation.reservation_number,
      reservation.guest_first_name,
      reservation.guest_last_name,
    ),
    details: buildReservationLogDetails([], {
      actorSource: "staff",
      summary: "Reservierung gelöscht",
    }),
  });
}

export async function logReservationTableAssignFromBrowser(params: {
  reservation: ReservationListRow;
  newTableId: string | null;
  tables: readonly DiningTableRow[];
  statuses: readonly ReservationStatusJoin[];
}): Promise<void> {
  const payload: ReservationUpdatePayload = {
    guest_first_name: params.reservation.guest_first_name,
    guest_last_name: params.reservation.guest_last_name,
    guest_phone: params.reservation.guest_phone,
    guest_email: params.reservation.guest_email,
    party_size: params.reservation.party_size,
    starts_at: params.reservation.starts_at,
    ends_at: params.reservation.ends_at,
    status_id: params.reservation.reservation_statuses?.id ?? "",
    dining_table_id: params.newTableId,
    dwell_minutes: params.reservation.dwell_minutes,
    notify_email: params.reservation.notify_email,
    notify_whatsapp: params.reservation.notify_whatsapp,
    terms_accepted: params.reservation.terms_accepted,
  };
  await logReservationUpdateFromBrowser({
    reservation: params.reservation,
    payload,
    statuses: params.statuses,
    tables: params.tables,
  });
}
