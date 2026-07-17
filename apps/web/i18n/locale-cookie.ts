import {
  APP_LOCALE_COOKIE,
  APP_LOCALE_COOKIE_MAX_AGE_SECONDS,
  type AppLocale,
} from "./config";

/** Client-side fallback — prefer `/api/profile/locale` Set-Cookie for PWA. */
export function writeAppLocaleCookie(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${APP_LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${APP_LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

export function readAppLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${APP_LOCALE_COOKIE}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
