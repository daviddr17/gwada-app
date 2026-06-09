/** Lokaler Kalendertag 00:00 */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Gesamter Kalendermonat (1. bis letzter Tag). */
export function calendarMonthRange(
  year: number,
  monthIndex: number,
): { start: Date; end: Date } {
  return {
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 0),
  };
}

export function monthVisibleDayRange(
  year: number,
  monthIndex: number,
  today: Date = new Date(),
): { start: Date; end: Date } {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const t0 = startOfLocalDay(today);
  const isCurrentMonth =
    monthStart.getFullYear() === t0.getFullYear() &&
    monthStart.getMonth() === t0.getMonth();
  const start =
    isCurrentMonth && monthStart < t0 ? new Date(t0) : new Date(monthStart);
  return { start, end: monthEnd };
}

export function daysInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= endDay) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function formatMonthTitleDe(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));
}

export function formatDayHeadingDe(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/** Lokaler Kalendertag 00:00 als ISO-UTC (für DB-Filter `starts_at`). */
export function localDayStartToUtcIso(d: Date): string {
  const t = startOfLocalDay(d);
  return new Date(
    t.getFullYear(),
    t.getMonth(),
    t.getDate(),
    0,
    0,
    0,
    0,
  ).toISOString();
}

/** Erster Moment nach dem letzten sichtbaren Tag (halb-offenes Intervall). */
export function exclusiveUtcIsoAfterLocalVisibleEnd(visibleEnd: Date): string {
  const t = startOfLocalDay(visibleEnd);
  t.setDate(t.getDate() + 1);
  return new Date(
    t.getFullYear(),
    t.getMonth(),
    t.getDate(),
    0,
    0,
    0,
    0,
  ).toISOString();
}
