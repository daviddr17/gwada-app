import { WEEKDAY_LABEL_DE, WEEKDAY_ORDER } from "@/lib/constants/restaurant-profile";
import type { DateHoursException, DayHours, Weekday } from "@/lib/types/restaurant";

const JS_DAY_TO_WEEKDAY: readonly Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function weekdayFromDateYmd(dateYmd: string): Weekday {
  const dayIndex = new Date(`${dateYmd}T12:00:00`).getDay();
  return JS_DAY_TO_WEEKDAY[dayIndex] ?? "monday";
}

export function formatDayHoursLabel(hours: DayHours): string {
  if (hours.closed) return "Geschlossen";
  if (hours.open && hours.close) return `${hours.open} – ${hours.close}`;
  return "—";
}

export function formatExceptionDateDe(dateYmd: string): string {
  try {
    return new Date(`${dateYmd}T12:00:00`).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateYmd;
  }
}

/** Kurzdatum für Inline-Zeilen unter Wochentagen, z. B. „16.06.“ */
export function formatExceptionDateShortDe(dateYmd: string): string {
  try {
    const d = new Date(`${dateYmd}T12:00:00`);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}.`;
  } catch {
    return dateYmd;
  }
}

export function localDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Ausnahmen von heute bis einschließlich Ende des Folgemonats. */
export function upcomingOpeningExceptions(
  exceptions: DateHoursException[],
  today: Date = new Date(),
): DateHoursException[] {
  const startYmd = localDateYmd(today);
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const endYmd = localDateYmd(end);
  return exceptions
    .filter((ex) => ex.date >= startYmd && ex.date <= endYmd)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Kommende Ausnahmen gruppiert nach Wochentag (Mo–So). */
export function groupUpcomingExceptionsByWeekday(
  exceptions: DateHoursException[],
  today: Date = new Date(),
): Partial<Record<Weekday, DateHoursException[]>> {
  const grouped: Partial<Record<Weekday, DateHoursException[]>> = {};
  for (const ex of upcomingOpeningExceptions(exceptions, today)) {
    const day = weekdayFromDateYmd(ex.date);
    const list = grouped[day] ?? [];
    list.push(ex);
    grouped[day] = list;
  }
  return grouped;
}

export function openingHoursWeekdayRows(
  weeklyHours: Record<Weekday, DayHours>,
): Array<{ day: Weekday; label: string; value: string }> {
  return WEEKDAY_ORDER.map((day) => ({
    day,
    label: WEEKDAY_LABEL_DE[day],
    value: formatDayHoursLabel(weeklyHours[day]),
  }));
}
