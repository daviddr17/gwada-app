import type { DashboardCalendarDaySummary } from "@/lib/dashboard/dashboard-calendar-types";
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Leere Monats-Tage für sofortiges Grid (Signale kommen nach dem Fetch). */
export function emptyCalendarMonthDays(
  month: string,
): DashboardCalendarDaySummary[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return [];
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return [];
  }
  const total = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const days: DashboardCalendarDaySummary[] = [];
  for (let day = 1; day <= total; day++) {
    days.push({
      date: `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`,
      reservationCount: 0,
      privateEventCount: 0,
      plannedStaffCount: 0,
      scheduledNewsCount: 0,
      holidayName: null,
      hoursException: null,
    });
  }
  return days;
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
