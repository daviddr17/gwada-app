import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantTodayYmd,
} from "@/lib/restaurant/restaurant-timezone";

/** Monat als YYYY-MM in Restaurant-Zeitzone. */
export function restaurantMonthKey(
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  date: Date = new Date(),
): string {
  return restaurantTodayYmd(timeZone, date).slice(0, 7);
}

export function shiftMonthKey(month: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return month;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1 + delta;
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthTitleDe(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return month;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
}

/** Montag = 0 … Sonntag = 6 für YYYY-MM-DD (UTC-Mitternacht). */
export function weekdayIndexMondayFirst(ymd: string): number {
  const [y, mo, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, mo! - 1, d!));
  const js = utc.getUTCDay(); // 0=So
  return js === 0 ? 6 : js - 1;
}

export const DASHBOARD_CALENDAR_WEEKDAY_LABELS = [
  "Mo",
  "Di",
  "Mi",
  "Do",
  "Fr",
  "Sa",
  "So",
] as const;
