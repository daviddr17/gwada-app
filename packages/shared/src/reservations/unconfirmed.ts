export const RESERVATIONS_UNCONFIRMED_QUERY = "unconfirmed";

export const UNCONFIRMED_RESERVATION_STATUS_CODES = [
  "pending",
  "change_requested",
] as const;

export type UnconfirmedReservationStatusCode =
  (typeof UNCONFIRMED_RESERVATION_STATUS_CODES)[number];

export function isUnconfirmedReservationStatusCode(code: string): boolean {
  return (UNCONFIRMED_RESERVATION_STATUS_CODES as readonly string[]).includes(
    code,
  );
}

export function isUnconfirmedReservation(row: {
  reservation_statuses?: { code: string } | null;
  status?: { code: string } | null;
}): boolean {
  const code =
    row.reservation_statuses?.code ?? row.status?.code ?? "";
  return isUnconfirmedReservationStatusCode(code);
}
