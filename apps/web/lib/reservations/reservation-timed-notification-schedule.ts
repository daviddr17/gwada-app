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

/**
 * Max. Alter einer geplanten Outbox-Zeile ab `send_at`, bevor Cron sie als zu spät
 * verwirft (statt Gäste Tage später mit Erinnerung/Danke zu überraschen).
 * Deckelt auch Cron-Ausfälle + WAHA-Timeouts, die die Queue mit Altlasten verstopfen.
 */
export const RESERVATION_OUTBOX_STALE_AFTER_MS = 36 * 60 * 60 * 1000;

/** Erinnerung: sinnlos, sobald der Termin begonnen hat. */
export function isReservationReminderTooLate(
  startsAtIso: string,
  now: Date = new Date(),
): boolean {
  const startsMs = Date.parse(startsAtIso);
  if (!Number.isFinite(startsMs)) return true;
  return startsMs <= now.getTime();
}

/**
 * Geplante Nachricht zu spät für den Versand (Cron/WAHA-Ausfall länger als Grace).
 * `sendAtIso` = Outbox-`send_at`.
 */
export function isReservationOutboxSendAtTooStale(
  sendAtIso: string,
  now: Date = new Date(),
  staleAfterMs: number = RESERVATION_OUTBOX_STALE_AFTER_MS,
): boolean {
  const sendMs = Date.parse(sendAtIso);
  if (!Number.isFinite(sendMs)) return true;
  return now.getTime() - sendMs > staleAfterMs;
}
