import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  APP_LOCALE_COOKIE,
  DEFAULT_APP_LOCALE,
  type AppLocale,
  isAppLocale,
  normalizeAppLocale,
} from "./config";
import "./global";

async function resolveRequestLocale(): Promise<AppLocale> {
  const store = await cookies();
  const fromCookie = store.get(APP_LOCALE_COOKIE)?.value;
  if (fromCookie && isAppLocale(fromCookie)) {
    return fromCookie;
  }
  if (fromCookie) {
    return normalizeAppLocale(fromCookie);
  }

  const accept = (await headers()).get("accept-language");
  if (accept) {
    const primary = accept.split(",")[0]?.trim();
    if (primary) return normalizeAppLocale(primary);
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
