import {
  APP_LOCALES,
  APP_LOCALE_NATIVE_LABELS,
  DEFAULT_APP_LOCALE,
  type AppLocale,
  isAppLocale,
  normalizeAppLocale,
} from "@/i18n/config";

/** Guest preference in embed iframe (not staff profile cookie). */
export const EMBED_LOCALE_COOKIE = "gwada_embed_locale";

export const EMBED_LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const EMBED_LOCALE_QUERY_PARAM = "lang";

/** Flag emoji for the embed language picker. */
export const EMBED_LOCALE_FLAGS: Record<AppLocale, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  it: "🇮🇹",
  tr: "🇹🇷",
  ar: "🇸🇦",
  zh: "🇨🇳",
};

export const EMBED_LOCALES = APP_LOCALES;

export { APP_LOCALE_NATIVE_LABELS as EMBED_LOCALE_LABELS };

export function normalizeEmbedLocale(
  value: string | null | undefined,
): AppLocale {
  return normalizeAppLocale(value);
}

export function parseRestaurantDefaultLocale(
  value: string | null | undefined,
): AppLocale {
  if (value && isAppLocale(value)) return value;
  return normalizeAppLocale(value) || DEFAULT_APP_LOCALE;
}

export type EmbedLocaleOption = {
  locale: AppLocale;
  flag: string;
  label: string;
};

export function embedLocaleOptions(): EmbedLocaleOption[] {
  return EMBED_LOCALES.map((locale) => ({
    locale,
    flag: EMBED_LOCALE_FLAGS[locale],
    label: APP_LOCALE_NATIVE_LABELS[locale],
  }));
}
