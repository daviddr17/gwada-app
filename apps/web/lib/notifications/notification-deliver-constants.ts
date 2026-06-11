/** Max. Zustellversuche pro Delivery-Zeile (inkl. erstem Versuch). */
export const NOTIFICATION_DELIVER_MAX_ATTEMPTS = 3;

/** Globales Rate-Limit: Zustellungen pro Cron-Lauf (ca. 1 Sekunde Pause zwischen Batches). */
export const NOTIFICATION_DELIVER_RATE_PER_SECOND = 10;

/** Batch-Größen pro Worker-Schritt. */
export const NOTIFICATION_DELIVER_EVENTS_BATCH = 25;
export const NOTIFICATION_DELIVER_SEND_BATCH = 20;

/** Backoff in ms nach Fehlversuch (Index = attempts nach Increment). */
export const NOTIFICATION_DELIVER_BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
] as const;
