/**
 * Nur für Client-Komponenten — gleiche Namen wie server `AUTH_ENTRY_COOKIES_TO_CLEAR`,
 * ohne server-only Imports.
 */
export const LEGACY_OAUTH_PENDING_COOKIE_NAMES_CLIENT = [
  "gwada_meta_oauth_pending",
  "gwada_google_oauth_pending",
] as const;

export const LEGACY_AUTH_COOKIES_TO_CLEAR_CLIENT = [
  ...LEGACY_OAUTH_PENDING_COOKIE_NAMES_CLIENT,
  "gwada_oauth_pending_id",
] as const;
