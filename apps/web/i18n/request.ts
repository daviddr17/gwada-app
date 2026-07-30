import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  APP_LOCALE_COOKIE,
  DEFAULT_APP_LOCALE,
  type AppLocale,
  isAppLocale,
  normalizeAppLocale,
} from "./config";
import "./global";

/**
 * UI language: cookie (user choice) → German product default.
 * Do not follow Accept-Language — that made French browsers land on `fr`
 * without ever picking a language (legacy `fr-GP` profile default made it worse).
 */
async function resolveRequestLocale(): Promise<AppLocale> {
  const store = await cookies();
  const fromCookie = store.get(APP_LOCALE_COOKIE)?.value;
  if (fromCookie && isAppLocale(fromCookie)) {
    return fromCookie;
  }
  if (fromCookie) {
    return normalizeAppLocale(fromCookie);
  }

  return DEFAULT_APP_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
