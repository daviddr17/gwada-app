import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import {
  RESERVATIONS_UNCONFIRMED_QUERY,
  UNCONFIRMED_RESERVATION_STATUS_CODES,
  isUnconfirmedReservation as isUnconfirmedReservationShared,
  type UnconfirmedReservationStatusCode,
} from "@gwada/shared";

export {
  RESERVATIONS_UNCONFIRMED_QUERY,
  UNCONFIRMED_RESERVATION_STATUS_CODES,
  type UnconfirmedReservationStatusCode,
};

export function reservationsUnconfirmedOverviewHref(): string {
  return `/dashboard/reservierungen/uebersicht?${RESERVATIONS_UNCONFIRMED_QUERY}=1`;
}

export function isUnconfirmedReservation(
  row: Pick<ReservationListRow, "reservation_statuses">,
): boolean {
  return isUnconfirmedReservationShared(row);
}
