import type { ReservationStatusJoin } from "@/lib/supabase/reservations-db";
import { reservationStatusStripeHex } from "@/lib/reservations/reservation-status-ui";
import { APP_SIGNAL_COLORS } from "@/lib/ui/app-signal-colors";

/** Normale Gast-Reservierung (Default). */
export const RESERVATION_KIND_GUEST = "guest" as const;
/** Manuelle Veranstaltung (Privatfeier o. Ä.) aus dem Dashboard. */
export const RESERVATION_KIND_PRIVATE_EVENT = "private_event" as const;

export type ReservationKind =
  | typeof RESERVATION_KIND_GUEST
  | typeof RESERVATION_KIND_PRIVATE_EVENT;

/** Streifenfarbe für Veranstaltungen — gleich `APP_SIGNAL_COLORS.events`. */
export const PRIVATE_EVENT_STRIPE_HEX = APP_SIGNAL_COLORS.events;

export function isReservationKind(value: unknown): value is ReservationKind {
  return value === RESERVATION_KIND_GUEST || value === RESERVATION_KIND_PRIVATE_EVENT;
}

export function normalizeReservationKind(value: unknown): ReservationKind {
  return isReservationKind(value) ? value : RESERVATION_KIND_GUEST;
}

export function isPrivateEventReservation(
  row: { kind?: string | null } | null | undefined,
): boolean {
  return normalizeReservationKind(row?.kind) === RESERVATION_KIND_PRIVATE_EVENT;
}

export function reservationListStripeHex(
  row: {
    kind?: string | null;
    reservation_statuses?: Pick<ReservationStatusJoin, "color_hex"> | null;
  },
): string {
  if (isPrivateEventReservation(row)) return PRIVATE_EVENT_STRIPE_HEX;
  return reservationStatusStripeHex(row.reservation_statuses);
}

export function reservationKindLabel(kind: ReservationKind): string {
  return kind === RESERVATION_KIND_PRIVATE_EVENT
    ? "Veranstaltung"
    : "Reservierung";
}
