import {
  NEWS_PLATFORM_LABELS,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import type { NewsPlatformSyncAnalyticsRow } from "@/lib/supabase/news-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type NewsStatsPeriod = 3 | 6 | 12;

const PLATFORM_COLORS: Record<NewsPlatform, string> = {
  gwada: "var(--accent)",
  facebook: "var(--chart-1)",
  instagram: "var(--chart-2)",
  google_business: "var(--chart-3)",
  whatsapp_channel: "var(--chart-4)",
};

const STATUS_LABELS: Record<UnifiedNewsItem["status"], string> = {
  draft: "Entwurf",
  scheduled: "Geplant",
  published: "Veröffentlicht",
  failed: "Fehlgeschlagen",
  archived: "Archiviert",
};

const STATUS_COLORS: Record<UnifiedNewsItem["status"], string> = {
  draft: "var(--chart-5)",
  scheduled: "var(--chart-4)",
  published: "var(--chart-2)",
  failed: "var(--chart-1)",
  archived: "var(--chart-3)",
};

export type NewsStatisticsInput = {
  items: UnifiedNewsItem[];
  syncRows: NewsPlatformSyncAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

export type NewsStatisticsResult = {
  totalItemsAll: number;
  itemsInPeriod: number;
  publishedInPeriod: number;
  scheduledCount: number;
  draftCount: number;
  gwadaItemsInPeriod: number;
  externalItemsInPeriod: number;
  withMediaInPeriod: number;
  externalCachedTotal: number;
  topPlatform: string | null;
  topStatus: string | null;
  byPlatform: Array<{
    platform: NewsPlatform;
    label: string;
    count: number;
    color: string;
  }>;
  byStatus: Array<{ name: string; count: number; fill: string }>;
  bySource: Array<{ name: string; count: number; fill: string }>;
  byMonth: Array<{ month: string; count: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
};

function itemDate(item: UnifiedNewsItem): string {
  return item.publishedAt ?? item.createdAt;
}

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

export function computeNewsStatistics(
  input: NewsStatisticsInput,
): NewsStatisticsResult {
  const itemsInPeriod = input.items.filter((item) =>
    inPeriod(itemDate(item), input.periodStart, input.periodEnd),
  );

  const publishedInPeriod = itemsInPeriod.filter(
    (item) => item.status === "published",
  ).length;
  const scheduledCount = input.items.filter(
    (item) => item.status === "scheduled",
  ).length;
  const draftCount = input.items.filter((item) => item.status === "draft").length;
  const gwadaItemsInPeriod = itemsInPeriod.filter(
    (item) => item.source === "gwada",
  ).length;
  const externalItemsInPeriod = itemsInPeriod.filter(
    (item) => item.source === "external",
  ).length;
  const withMediaInPeriod = itemsInPeriod.filter(
    (item) => item.media.length > 0,
  ).length;
  const externalCachedTotal = input.syncRows.reduce(
    (sum, row) => sum + row.item_count,
    0,
  );

  const platformCounts = new Map<NewsPlatform, number>();
  for (const item of itemsInPeriod) {
    platformCounts.set(item.platform, (platformCounts.get(item.platform) ?? 0) + 1);
  }
  const byPlatform = (Object.keys(NEWS_PLATFORM_LABELS) as NewsPlatform[])
    .map((platform) => ({
      platform,
      label: NEWS_PLATFORM_LABELS[platform],
      count: platformCounts.get(platform) ?? 0,
      color: PLATFORM_COLORS[platform],
    }))
    .filter((row) => row.count > 0);
  const topPlatformEntry = [...byPlatform].sort((a, b) => b.count - a.count)[0];
  const topPlatform = topPlatformEntry?.label ?? null;

  const statusCounts = new Map<UnifiedNewsItem["status"], number>();
  for (const item of itemsInPeriod) {
    statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);
  }
  const byStatus = (
    Object.keys(STATUS_LABELS) as UnifiedNewsItem["status"][]
  )
    .map((status) => ({
      name: STATUS_LABELS[status],
      count: statusCounts.get(status) ?? 0,
      fill: STATUS_COLORS[status],
    }))
    .filter((row) => row.count > 0);
  const topStatusEntry = [...byStatus].sort((a, b) => b.count - a.count)[0];
  const topStatus = topStatusEntry?.name ?? null;

  const bySource = [
    {
      name: "Gwada",
      count: gwadaItemsInPeriod,
      fill: "var(--accent)",
    },
    {
      name: "Extern",
      count: externalItemsInPeriod,
      fill: "var(--chart-2)",
    },
  ].filter((row) => row.count > 0);

  const monthCounts = new Map<string, number>();
  for (const item of itemsInPeriod) {
    const key = monthKey(itemDate(item));
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const byMonth = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: formatMonthLabel(month),
      count,
    }));

  const weekdayCounts = new Map<number, number>();
  for (const item of itemsInPeriod) {
    const d = new Date(itemDate(item)).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  return {
    totalItemsAll: input.items.length,
    itemsInPeriod: itemsInPeriod.length,
    publishedInPeriod,
    scheduledCount,
    draftCount,
    gwadaItemsInPeriod,
    externalItemsInPeriod,
    withMediaInPeriod,
    externalCachedTotal,
    topPlatform,
    topStatus,
    byPlatform,
    byStatus,
    bySource,
    byMonth,
    byWeekday,
  };
}
