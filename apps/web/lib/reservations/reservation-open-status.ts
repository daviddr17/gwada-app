import { isUnconfirmedReservation } from "@/lib/reservations/unconfirmed-reservations";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";

export const OPEN_RESERVATION_STATUS_CODES = [
  "pending",
  "change_requested",
] as const;

export type OpenReservationStatusCode =
  (typeof OPEN_RESERVATION_STATUS_CODES)[number];

export function isOpenReservationStatusCode(
  code: string,
): code is OpenReservationStatusCode {
  return (OPEN_RESERVATION_STATUS_CODES as readonly string[]).includes(code);
}

export function shouldDecrementUnconfirmedCount(params: {
  previousStatusCode: string;
  nextStatusCode: string;
}): boolean {
  return (
    isOpenReservationStatusCode(params.previousStatusCode) &&
    !isOpenReservationStatusCode(params.nextStatusCode)
  );
}

export function isUnconfirmedReservationStatusCode(code: string): boolean {
  return isUnconfirmedReservation({
    reservation_statuses: { code, name: "", id: "", color_hex: "" },
  });
}

export type ReservationOpenResolvedDetail = {
  restaurantId: string;
  reservationId: string;
  previousStatusCode: string;
  nextStatusCode: string;
};

export const GWADA_RESERVATION_OPEN_RESOLVED_EVENT =
  "gwada:reservation-open-resolved";

export function dispatchReservationOpenResolvedLivePatch(
  detail: ReservationOpenResolvedDetail,
): void {
  if (typeof window === "undefined") return;
  if (!isOpenReservationStatusCode(detail.previousStatusCode)) return;
  window.dispatchEvent(
    new CustomEvent(GWADA_RESERVATION_OPEN_RESOLVED_EVENT, { detail }),
  );
}

/** Hilfszeile für Change-Request: Status vor der Anfrage. */
export function resolveStatusCodeById(
  statuses: ReadonlyArray<{ id: string; code: string }>,
  statusId: string | null | undefined,
): string | null {
  if (!statusId) return null;
  return statuses.find((s) => s.id === statusId)?.code ?? null;
}

export function nextStatusCodeAfterChangeRequestApprove(
  statuses: ReadonlyArray<{ id: string; code: string }>,
  reservation: Pick<ReservationListRow, "status_before_change_id">,
): string {
  return (
    resolveStatusCodeById(statuses, reservation.status_before_change_id) ??
    "confirmed"
  );
}

export function nextStatusCodeAfterChangeRequestDecline(
  statuses: ReadonlyArray<{ id: string; code: string }>,
  reservation: Pick<ReservationListRow, "status_before_change_id">,
): string {
  return (
    resolveStatusCodeById(statuses, reservation.status_before_change_id) ??
    "pending"
  );
}
