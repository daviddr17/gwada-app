import type { ReservationAnalyticsRow } from "@/lib/supabase/reservations-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type ReservationStatsPeriod = 3 | 6 | 12;

function statusCode(row: ReservationAnalyticsRow): string {
  return row.reservation_statuses?.code ?? "";
}

/** Für Zeit-/Vorlauf-Auswertungen: echte Buchungsabsicht ohne No-Show. */
export function isBookingIntent(row: ReservationAnalyticsRow): boolean {
  const code = statusCode(row);
  return code === "pending" || code === "confirmed";
}

/** Für Mengen-Trends: alles außer No-Show. */
export function isCountedReservation(row: ReservationAnalyticsRow): boolean {
  return statusCode(row) !== "no_show";
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export type ReservationStatsResult = {
  totalInPeriod: number;
  bookingIntentCount: number;
  avgLeadDays: number | null;
  medianLeadDays: number | null;
  avgPartySize: number | null;
  totalGuests: number;
  topWeekday: string | null;
  byHour: Array<{ hour: string; hourNum: number; count: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  byStatus: Array<{ code: string; name: string; color: string; count: number }>;
};

export function computeReservationStats(
  rows: ReservationAnalyticsRow[],
): ReservationStatsResult {
  const counted = rows.filter(isCountedReservation);
  const bookings = rows.filter(isBookingIntent);

  const leadDays = bookings
    .map((r) => {
      const created = new Date(r.created_at).getTime();
      const starts = new Date(r.starts_at).getTime();
      if (!Number.isFinite(created) || !Number.isFinite(starts) || starts <= created) {
        return null;
      }
      return (starts - created) / (1000 * 60 * 60 * 24);
    })
    .filter((d): d is number => d != null && d >= 0);

  const leadSum = leadDays.reduce((s, d) => s + d, 0);
  const avgLeadDays =
    leadDays.length > 0 ? Math.round((leadSum / leadDays.length) * 10) / 10 : null;
  const medianLeadDays =
    median(leadDays) != null
      ? Math.round((median(leadDays) as number) * 10) / 10
      : null;

  const partySizes = bookings.map((r) => r.party_size).filter((n) => n > 0);
  const avgPartySize =
    partySizes.length > 0
      ? Math.round(
          (partySizes.reduce((s, n) => s + n, 0) / partySizes.length) * 10,
        ) / 10
      : null;
  const totalGuests = bookings.reduce((s, r) => s + r.party_size, 0);

  const hourCounts = new Map<number, number>();
  for (const r of bookings) {
    const h = new Date(r.starts_at).getHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  const byHour = Array.from({ length: 24 }, (_, hourNum) => ({
    hourNum,
    hour: formatHourLabel(hourNum),
    count: hourCounts.get(hourNum) ?? 0,
  }));

  const weekdayCounts = new Map<number, number>();
  for (const r of bookings) {
    const d = new Date(r.starts_at).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));
  const topWeekdayEntry = [...byWeekday].sort((a, b) => b.count - a.count)[0];
  const topWeekday =
    topWeekdayEntry && topWeekdayEntry.count > 0 ? topWeekdayEntry.day : null;

  const monthCounts = new Map<string, number>();
  for (const r of counted) {
    const d = new Date(r.starts_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const byMonth = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: formatMonthLabel(month),
      count,
    }));

  const statusCounts = new Map<
    string,
    { name: string; color: string; count: number }
  >();
  for (const r of counted) {
    const code = statusCode(r) || "unknown";
    if (code === "no_show") continue;
    const name = r.reservation_statuses?.name ?? code;
    const color = r.reservation_statuses?.color_hex ?? "var(--muted-foreground)";
    const prev = statusCounts.get(code);
    statusCounts.set(code, {
      name,
      color,
      count: (prev?.count ?? 0) + 1,
    });
  }
  const byStatus = [...statusCounts.entries()].map(([code, v]) => ({
    code,
    name: v.name,
    color: v.color,
    count: v.count,
  }));

  return {
    totalInPeriod: counted.length,
    bookingIntentCount: bookings.length,
    avgLeadDays,
    medianLeadDays,
    avgPartySize,
    totalGuests,
    topWeekday,
    byHour,
    byWeekday,
    byMonth,
    byStatus,
  };
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}
