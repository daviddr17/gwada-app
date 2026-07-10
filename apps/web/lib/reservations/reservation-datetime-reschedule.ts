const TERMINAL_STATUS_CODES = new Set(["cancelled", "declined", "no_show"]);

export function reservationDateTimeChanged(
  before: { starts_at: string; ends_at: string },
  after: { starts_at: string; ends_at: string },
): boolean {
  return (
    before.starts_at !== after.starts_at || before.ends_at !== after.ends_at
  );
}

/** Geplante Erinnerung/Danke neu terminieren, wenn Termin sich ändert und Status nicht terminal ist. */
export function shouldRescheduleTimedOutbox(
  statusCode: string,
  datetimeChanged: boolean,
): boolean {
  return datetimeChanged && !TERMINAL_STATUS_CODES.has(statusCode);
}
