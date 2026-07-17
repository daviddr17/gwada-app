import {
  APP_LOCALE_COOKIE,
  APP_LOCALE_COOKIE_MAX_AGE_SECONDS,
  type AppLocale,
} from "./config";

/** Client-side: persist UI locale for subsequent RSC/request config. */
export function writeAppLocaleCookie(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${APP_LOCALE_COOKIE}=${locale}; path=/; max-age=${APP_LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

export function readAppLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${APP_LOCALE_COOKIE}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
