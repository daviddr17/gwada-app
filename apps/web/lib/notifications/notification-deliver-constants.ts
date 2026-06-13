/** Max. Zustellversuche pro Delivery-Zeile (inkl. erstem Versuch). */
export const NOTIFICATION_DELIVER_MAX_ATTEMPTS = 3;

/** Globales Rate-Limit: Zustellungen pro Sekunde innerhalb eines Cron-Laufs. */
export const NOTIFICATION_DELIVER_RATE_PER_SECOND = 10;

/** Batch-Größen pro Claim-Schritt. */
export const NOTIFICATION_DELIVER_EVENTS_BATCH = 50;
export const NOTIFICATION_DELIVER_SEND_BATCH = 30;

/** Max. Laufzeit pro Cron-Aufruf — Queue leeren bis Budget oder leer. */
export const NOTIFICATION_DELIVER_RUN_BUDGET_MS = 110_000;

/** Sicherheits-Obergrenze gegen Endlosschleifen bei Bugs. */
export const NOTIFICATION_DELIVER_MAX_LOOP_ITERATIONS = 200;

/** Backoff in ms nach Fehlversuch (Index = attempts nach Increment). */
export const NOTIFICATION_DELIVER_BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
] as const;
