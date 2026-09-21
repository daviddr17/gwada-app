import {
  APP_LOCALE_TO_PROFILE,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n/config";
import { WEEKDAY_ORDER } from "@/lib/constants/restaurant-profile";
import type { Weekday } from "@/lib/types/restaurant";

/** 2024-01-01 was a Monday — stable anchor for Intl weekday names. */
const WEEKDAY_REF_MONDAY_MS = Date.UTC(2024, 0, 1, 12);

/**
 * Locale-aware weekday label for DB keys (`monday`…`sunday`).
 * Falls back to the raw key when unknown (never hard-codes DE-only maps).
 */
export function weekdayLabelForLocale(
  weekday: string | null | undefined,
  locale: AppLocale | string | null | undefined,
  style: "short" | "long" = "short",
): string {
  const key = (weekday ?? "").trim().toLowerCase();
  const idx = WEEKDAY_ORDER.indexOf(key as Weekday);
  if (idx < 0) return key || "?";

  const appLocale = normalizeAppLocale(locale);
  const date = new Date(WEEKDAY_REF_MONDAY_MS + idx * 86_400_000);
  return new Intl.DateTimeFormat(APP_LOCALE_TO_PROFILE[appLocale], {
    weekday: style,
  }).format(date);
}
