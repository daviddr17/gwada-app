import type { ReservationListRow } from "@/lib/supabase/reservations-db";

/** Query-Parameter für die Übersicht „alle unbestätigten“. */
export const RESERVATIONS_UNCONFIRMED_QUERY = "unconfirmed";

export const UNCONFIRMED_RESERVATION_STATUS_CODES = [
  "pending",
  "change_requested",
] as const;

export type UnconfirmedReservationStatusCode =
  (typeof UNCONFIRMED_RESERVATION_STATUS_CODES)[number];

export function reservationsUnconfirmedOverviewHref(): string {
  return `/dashboard/reservierungen/uebersicht?${RESERVATIONS_UNCONFIRMED_QUERY}=1`;
}

export function isUnconfirmedReservation(
  row: Pick<ReservationListRow, "reservation_statuses">,
): boolean {
  const code = row.reservation_statuses?.code ?? "";
  return (UNCONFIRMED_RESERVATION_STATUS_CODES as readonly string[]).includes(
    code,
  );
}
