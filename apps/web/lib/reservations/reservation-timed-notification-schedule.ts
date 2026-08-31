/**
 * Geplante Reservierungs-Nachrichten (Erinnerung / Danke & Bewertung).
 *
 * Anker ist immer `starts_at` (Termin-Uhrzeit in Restaurant-Zeitzone, als UTC-Instant
 * in der DB). Erinnerung: X Stunden **vor** dem Termin. Danke: X Stunden **danach**.
 */
export function computeReservationReminderSendAt(
  startsAtIso: string,
  hoursBefore: number,
): Date {
  const startsMs = Date.parse(startsAtIso);
  if (!Number.isFinite(startsMs)) {
    throw new Error("invalid starts_at");
  }
  return new Date(startsMs - hoursBefore * 60 * 60 * 1000);
}

export function computeReservationThanksSendAt(
  startsAtIso: string,
  hoursAfter: number,
): Date {
  const startsMs = Date.parse(startsAtIso);
  if (!Number.isFinite(startsMs)) {
    throw new Error("invalid starts_at");
  }
  return new Date(startsMs + hoursAfter * 60 * 60 * 1000);
}

/** Erinnerung nur planen, wenn der Zeitpunkt noch in der Zukunft liegt. */
export function shouldScheduleReservationReminder(
  sendAt: Date,
  now: Date = new Date(),
): boolean {
  return sendAt.getTime() > now.getTime();
}

/**
 * Danke planen, wenn der Zeitpunkt noch bevorsteht — sonst sofort (nächster Cron-Lauf),
 * z. B. bei verspäteter Bestätigung nach dem Termin.
 */
export function resolveReservationThanksSendAt(
  startsAtIso: string,
  hoursAfter: number,
  now: Date = new Date(),
): Date {
  const target = computeReservationThanksSendAt(startsAtIso, hoursAfter);
  if (target.getTime() > now.getTime()) return target;
  return now;
}
