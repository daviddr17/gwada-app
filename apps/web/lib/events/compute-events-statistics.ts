import {
  EVENTS_PLATFORM_LABELS,
  type EventsPlatform,
} from "@/lib/constants/events-platforms";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import type { EventsPlatformSyncAnalyticsRow } from "@/lib/supabase/events-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type EventsStatsPeriod = 3 | 6 | 12;

const PLATFORM_COLORS: Record<EventsPlatform, string> = {
  gwada: "var(--accent)",
  facebook: "var(--chart-1)",
  google_business: "var(--chart-2)",
  instagram: "var(--chart-3)",
  whatsapp_channel: "var(--chart-4)",
};

export type EventsStatisticsInput = {
  items: UnifiedEventItem[];
  syncRows: EventsPlatformSyncAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

export type EventsStatisticsResult = {
  totalItemsAll: number;
  itemsInPeriod: number;
  upcomingCount: number;
  pastInPeriod: number;
  withTicketLinkInPeriod: number;
  gwadaItemsInPeriod: number;
  externalItemsInPeriod: number;
  externalCachedTotal: number;
  topPlatform: string | null;
  byPlatform: Array<{
    platform: EventsPlatform;
    label: string;
    count: number;
    color: string;
  }>;
  byMonth: Array<{ month: string; count: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
};

function inPeriod(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function computeEventsStatistics(
  input: EventsStatisticsInput,
): EventsStatisticsResult {
  const now = Date.now();
  const inRange = input.items.filter((item) =>
    inPeriod(item.startAt, input.periodStart, input.periodEnd),
  );

  const upcomingCount = input.items.filter(
    (item) => new Date(item.startAt).getTime() >= now,
  ).length;

  const pastInPeriod = inRange.filter(
    (item) => new Date(item.startAt).getTime() < now,
  ).length;

  const withTicketLinkInPeriod = inRange.filter((item) =>
    Boolean(item.ticketUrl?.trim()),
  ).length;

  const gwadaItemsInPeriod = inRange.filter((item) => item.source === "gwada").length;
  const externalItemsInPeriod = inRange.length - gwadaItemsInPeriod;

  const platformCounts = new Map<EventsPlatform, number>();
  for (const item of inRange) {
    platformCounts.set(item.platform, (platformCounts.get(item.platform) ?? 0) + 1);
  }

  const byPlatform = [...platformCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => ({
      platform,
      label: EVENTS_PLATFORM_LABELS[platform],
      count,
      color: PLATFORM_COLORS[platform],
    }));

  const topPlatform = byPlatform[0]?.label ?? null;

  const monthCounts = new Map<string, number>();
  for (const item of inRange) {
    const key = monthKey(item.startAt);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const months: string[] = [];
  const cursor = new Date(input.periodStart);
  cursor.setDate(1);
  const endMonth = new Date(input.periodEnd);
  endMonth.setDate(1);
  while (cursor <= endMonth) {
    months.push(monthKey(cursor.toISOString()));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const byMonth = months.map((month) => ({
    month: formatMonthLabel(month),
    count: monthCounts.get(month) ?? 0,
  }));

  const weekdayCounts = new Map<number, number>();
  for (const item of inRange) {
    const day = new Date(item.startAt).getDay();
    weekdayCounts.set(day, (weekdayCounts.get(day) ?? 0) + 1);
  }

  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    day: WEEKDAY_SHORT[dayIndex]!,
    dayIndex,
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  const externalCachedTotal = input.syncRows.reduce(
    (sum, row) => sum + row.item_count,
    0,
  );

  return {
    totalItemsAll: input.items.length,
    itemsInPeriod: inRange.length,
    upcomingCount,
    pastInPeriod,
    withTicketLinkInPeriod,
    gwadaItemsInPeriod,
    externalItemsInPeriod,
    externalCachedTotal,
    topPlatform,
    byPlatform,
    byMonth,
    byWeekday,
  };
}
