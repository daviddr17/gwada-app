export const RESERVATION_STATUS_CONFIRMED = "confirmed" as const;
export const RESERVATION_STATUS_SEATED = "seated" as const;

export type ReservationStatusCodeLike = {
  code: string;
};

export type DiningTableLabelLike = {
  table_name: string | null;
  table_number: number;
};

export function formatDiningTableLabel(
  table: DiningTableLabelLike,
): string {
  const name = table.table_name?.trim();
  return name && name.length > 0 ? name : `Tisch ${table.table_number}`;
}

export function isConfirmedReservationStatus(
  status: ReservationStatusCodeLike | null | undefined,
): boolean {
  return status?.code === RESERVATION_STATUS_CONFIRMED;
}

export function isSeatedReservationStatus(
  status: ReservationStatusCodeLike | null | undefined,
): boolean {
  return status?.code === RESERVATION_STATUS_SEATED;
}

export function reservationContributesToTableOccupancy(
  status: ReservationStatusCodeLike | null | undefined,
): boolean {
  return isConfirmedReservationStatus(status) || isSeatedReservationStatus(status);
}

export function reservationDiningTableLabel(row: {
  dining_table_id: string | null;
  dining_tables: DiningTableLabelLike | null;
  reservation_statuses?: ReservationStatusCodeLike | null;
  status?: ReservationStatusCodeLike | null;
}): string | null {
  const status = row.reservation_statuses ?? row.status ?? null;
  if (!isConfirmedReservationStatus(status)) return null;
  if (!row.dining_table_id || !row.dining_tables) return null;
  return formatDiningTableLabel(row.dining_tables);
}

export function formatReservationGuestName(row: {
  guest_first_name: string;
  guest_last_name: string;
}): string {
  return `${row.guest_first_name} ${row.guest_last_name}`.trim();
}
