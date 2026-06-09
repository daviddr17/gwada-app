import { formatReservationGuestName, reservationDiningTableLabel } from "@gwada/shared";
import type { TableReservationRow } from "@/src/lib/dining-floor";
import type { ReservationListRow } from "@/src/lib/reservations/reservations-db";

export type ReservationDetailData = {
  id: string;
  reservationNumber: number | null;
  guest_first_name: string;
  guest_last_name: string;
  party_size: number;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  status: { code: string; name: string; color_hex: string } | null;
  tableLabel: string | null;
};

export function reservationDetailFromTableRow(
  row: TableReservationRow,
): ReservationDetailData {
  return {
    id: row.id,
    reservationNumber: row.reservation_number,
    guest_first_name: row.guest_first_name,
    guest_last_name: row.guest_last_name,
    party_size: row.party_size,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    notes: row.notes,
    guest_phone: null,
    guest_email: null,
    status: row.status,
    tableLabel: null,
  };
}

export function reservationDetailFromListRow(
  row: ReservationListRow,
): ReservationDetailData {
  return {
    id: row.id,
    reservationNumber: row.reservation_number,
    guest_first_name: row.guest_first_name,
    guest_last_name: row.guest_last_name,
    party_size: row.party_size,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    notes: row.notes,
    guest_phone: row.guest_phone,
    guest_email: row.guest_email,
    status: row.reservation_statuses,
    tableLabel: reservationDiningTableLabel(row),
  };
}

export function reservationDetailGuestLabel(row: ReservationDetailData): string {
  return formatReservationGuestName(row);
}
