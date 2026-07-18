/** Absender-Adresse (SMTP-Konto bleibt Platform-SMTP; Reply-To / Kommunikation). */
export const PLATFORM_NEWSLETTER_FROM_EMAIL = "contact@gwada.app";
export const PLATFORM_NEWSLETTER_FROM_NAME = "Gwada";

/** Pro Cron-Lauf: kleine Batches für SMTP-Reputation. */
export const PLATFORM_NEWSLETTER_BATCH_SIZE = 25;

/** Pause zwischen Einzelmails im Batch (ms). */
export const PLATFORM_NEWSLETTER_SEND_GAP_MS = 400;

export const PLATFORM_NEWSLETTER_STORAGE_BUCKET = "platform-newsletter";

export const PLATFORM_NEWSLETTER_SOURCE_LOCALE = "de" as const;
