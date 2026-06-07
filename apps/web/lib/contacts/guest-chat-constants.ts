/** Standard-Gültigkeit Zugangscode nach Versand. */
export const DEFAULT_GUEST_CHAT_CODE_VALID_HOURS = 48;

/** Standard-Gültigkeit Session nach erfolgreichem Login. */
export const DEFAULT_GUEST_CHAT_SESSION_HOURS = 24;

/** Mindestabstand „Code erneut senden“. */
export const GUEST_CHAT_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export const GUEST_CHAT_MAX_FAILED_ATTEMPTS = 10;

export const GUEST_CHAT_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** Max. ausgestellte Zugangscodes pro Kontakt und Tag (Auto-Neuversand + Benachrichtigungen). */
export const GUEST_CHAT_MAX_CODES_PER_CONTACT_PER_DAY = 8;
