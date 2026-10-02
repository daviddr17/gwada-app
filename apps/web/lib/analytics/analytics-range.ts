export const ANALYTICS_TIME_ZONE = "Europe/Berlin";

export const ANALYTICS_RANGES = ["today", "7d", "30d", "90d"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const ANALYTICS_RANGE_DEFAULT: AnalyticsRange = "30d";

export function isAnalyticsRange(value: string | null | undefined): value is AnalyticsRange {
  return (ANALYTICS_RANGES as readonly string[]).includes(value ?? "");
}

type ZonedParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const map: Partial<ZonedParts> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") {
      map[part.type as keyof ZonedParts] = part.value;
    }
  }
  return map as ZonedParts;
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

/** Mitternacht des Kalendertags von `now` in der Zeitzone, als UTC-Instant. */
export function zonedDayStart(now: Date, timeZone = ANALYTICS_TIME_ZONE): Date {
  const p = zonedParts(now, timeZone);
  const utcMidnight = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    0,
    0,
    0,
  );
  let start = new Date(utcMidnight - timeZoneOffsetMs(new Date(utcMidnight), timeZone));
  const wall = zonedParts(start, timeZone);
  if (wall.hour !== "00" || wall.minute !== "00" || wall.day !== p.day) {
    start = new Date(utcMidnight - timeZoneOffsetMs(start, timeZone));
  }
  return start;
}

function addCalendarDays(
  ymd: { y: number; m: number; d: number },
  days: number,
): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Inklusiver Zeitraum bis `now`. „7 Tage“ beginnt um Mitternacht vor 6 Tagen. */
export function analyticsRangeBounds(
  range: AnalyticsRange,
  now = new Date(),
): { from: Date; to: Date } {
  if (range === "today") {
    return { from: zonedDayStart(now), to: now };
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const p = zonedParts(now, ANALYTICS_TIME_ZONE);
  const shifted = addCalendarDays(
    { y: Number(p.year), m: Number(p.month), d: Number(p.day) },
    -(days - 1),
  );
  const anchor = new Date(Date.UTC(shifted.y, shifted.m - 1, shifted.d, 12, 0, 0));
  return { from: zonedDayStart(anchor), to: now };
}
