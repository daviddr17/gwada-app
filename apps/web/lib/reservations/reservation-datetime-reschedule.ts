const TERMINAL_STATUS_CODES = new Set(["cancelled", "declined", "no_show"]);

/** Gleiche UTC-Instant, unabhängig von ISO-Serialisierung (`…Z` vs `…+00:00`). */
export function reservationIsoInstantsEqual(a: string, b: string): boolean {
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return a === b;
  return aMs === bMs;
}

/**
 * Terminwechsel = anderer Startzeitpunkt.
 * `ends_at` / Verweildauer ist intern abgeleitet und zählt nicht als Slot-Verschiebung
 * (sonst False-Positives durch ISO-Format oder neu berechnetes Ende).
 */
export function reservationDateTimeChanged(
  before: { starts_at: string; ends_at: string },
  after: { starts_at: string; ends_at: string },
): boolean {
  return !reservationIsoInstantsEqual(before.starts_at, after.starts_at);
}

/** Geplante Erinnerung/Danke neu terminieren, wenn Termin sich ändert und Status nicht terminal ist. */
export function shouldRescheduleTimedOutbox(
  statusCode: string,
  datetimeChanged: boolean,
): boolean {
  return datetimeChanged && !TERMINAL_STATUS_CODES.has(statusCode);
}
