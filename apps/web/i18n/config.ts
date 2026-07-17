/** App UI locales (short codes). Stored on `profiles.locale` as BCP-47 (e.g. de-DE). */
export const APP_LOCALES = ["de", "en", "fr"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

/** Default UI language — matches the current German product surface. */
export const DEFAULT_APP_LOCALE: AppLocale = "de";

/** Cookie read by `i18n/request.ts` (no locale URL prefix). */
export const APP_LOCALE_COOKIE = "gwada_locale";

export const APP_LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Map short UI locale → value written to `profiles.locale`. */
export const APP_LOCALE_TO_PROFILE: Record<AppLocale, string> = {
  de: "de-DE",
  en: "en-US",
  fr: "fr-FR",
};

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

/**
 * Normalize cookie / Accept-Language / `profiles.locale` (e.g. `de-DE`, `fr-GP`)
 * to a supported app locale.
 */
export function normalizeAppLocale(
  value: string | null | undefined,
): AppLocale {
  if (!value) return DEFAULT_APP_LOCALE;
  const raw = value.trim().replace(/_/g, "-");
  if (!raw) return DEFAULT_APP_LOCALE;

  const lower = raw.toLowerCase();
  if (isAppLocale(lower)) return lower;

  const primary = lower.split("-")[0] ?? "";
  if (isAppLocale(primary)) return primary;

  return DEFAULT_APP_LOCALE;
}

export function appLocaleToProfileLocale(locale: AppLocale): string {
  return APP_LOCALE_TO_PROFILE[locale];
}
