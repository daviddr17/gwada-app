export type ReservationStartsAtRow = {
  starts_at: string;
};

/** Stabiler Sortier-Key für `starts_at` (ISO / Postgres timestamptz). */
export function reservationStartsAtMs(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

export function compareReservationsByStart(
  a: ReservationStartsAtRow,
  b: ReservationStartsAtRow,
): number {
  const diff = reservationStartsAtMs(a.starts_at) - reservationStartsAtMs(b.starts_at);
  if (diff !== 0) return diff;
  return a.starts_at.localeCompare(b.starts_at);
}

export function sortReservationsByStart<T extends ReservationStartsAtRow>(
  rows: T[],
): T[] {
  return [...rows].sort(compareReservationsByStart);
}
