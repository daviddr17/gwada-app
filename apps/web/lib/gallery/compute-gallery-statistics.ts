import {
  GALLERY_PLATFORM_LABELS,
  type GalleryPlatform,
} from "@/lib/constants/gallery-platforms";
import { galleryCategoryLabelForPlatform } from "@/lib/gallery/gallery-categories";
import type {
  GalleryHighlightAnalyticsRow,
  GalleryItemAnalyticsRow,
  GalleryPlatformSyncAnalyticsRow,
} from "@/lib/supabase/gallery-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type GalleryStatsPeriod = 3 | 6 | 12;

const PLATFORM_COLORS: Record<GalleryPlatform, string> = {
  gwada: "var(--accent)",
  facebook: "var(--chart-1)",
  instagram: "var(--chart-2)",
  google_business: "var(--chart-3)",
};

export type GalleryStatisticsInput = {
  items: GalleryItemAnalyticsRow[];
  highlights: GalleryHighlightAnalyticsRow[];
  syncRows: GalleryPlatformSyncAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

export type GalleryStatisticsResult = {
  totalItemsInPeriod: number;
  totalItemsAll: number;
  gwadaItemsInPeriod: number;
  externalItemsInPeriod: number;
  imageCountInPeriod: number;
  videoCountInPeriod: number;
  storageUsedBytes: number;
  storageAddedInPeriodBytes: number;
  highlightsTotal: number;
  highlightsCreatedInPeriod: number;
  avgItemsPerHighlight: number | null;
  topPlatform: string | null;
  topCategory: string | null;
  externalCachedTotal: number;
  byPlatform: Array<{
    platform: GalleryPlatform;
    label: string;
    count: number;
    color: string;
  }>;
  byCategory: Array<{ name: string; count: number }>;
  byMediaKind: Array<{ kind: string; count: number; fill: string }>;
  byMonth: Array<{ month: string; count: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
};

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function categoryLabel(row: GalleryItemAnalyticsRow): string {
  return (
    row.category_label ??
    (row.category
      ? galleryCategoryLabelForPlatform(row.platform, row.category)
      : null) ??
    "Ohne Kategorie"
  );
}

export function formatGalleryBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(digits).replace(".", ",")} ${units[unitIndex]}`;
}

export function computeGalleryStatistics(
  input: GalleryStatisticsInput,
): GalleryStatisticsResult {
  const rangeStart = input.periodStart.getTime();
  const rangeEnd = input.periodEnd.getTime();
  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= rangeStart && t <= rangeEnd;
  };

  const periodItems = input.items.filter((item) => inPeriod(item.created_at));
  const gwadaItemsInPeriod = periodItems.filter(
    (item) => item.source === "gwada",
  ).length;
  const externalItemsInPeriod = periodItems.length - gwadaItemsInPeriod;
  const imageCountInPeriod = periodItems.filter(
    (item) => item.media_kind === "image",
  ).length;
  const videoCountInPeriod = periodItems.filter(
    (item) => item.media_kind === "video",
  ).length;

  const storageUsedBytes = input.items
    .filter((item) => item.source === "gwada")
    .reduce((sum, item) => sum + (item.size_bytes ?? 0), 0);
  const storageAddedInPeriodBytes = periodItems
    .filter((item) => item.source === "gwada")
    .reduce((sum, item) => sum + (item.size_bytes ?? 0), 0);

  const highlightsCreatedInPeriod = input.highlights.filter((h) =>
    inPeriod(h.created_at),
  ).length;
  const highlightItemCounts = input.highlights.map((h) => h.item_count);
  const avgItemsPerHighlight =
    highlightItemCounts.length > 0
      ? Math.round(
          (highlightItemCounts.reduce((a, b) => a + b, 0) /
            highlightItemCounts.length) *
            10,
        ) / 10
      : null;

  const platformCounts = new Map<GalleryPlatform, number>();
  for (const item of periodItems) {
    platformCounts.set(item.platform, (platformCounts.get(item.platform) ?? 0) + 1);
  }
  const byPlatform = (Object.keys(GALLERY_PLATFORM_LABELS) as GalleryPlatform[])
    .map((platform) => ({
      platform,
      label: GALLERY_PLATFORM_LABELS[platform],
      count: platformCounts.get(platform) ?? 0,
      color: PLATFORM_COLORS[platform],
    }))
    .filter((row) => row.count > 0);
  const topPlatformEntry = [...byPlatform].sort((a, b) => b.count - a.count)[0];
  const topPlatform =
    topPlatformEntry && topPlatformEntry.count > 0
      ? topPlatformEntry.label
      : null;

  const categoryCounts = new Map<string, number>();
  for (const item of periodItems) {
    const label = categoryLabel(item);
    categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1);
  }
  const byCategory = [...categoryCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topCategory = byCategory[0]?.name ?? null;

  const byMediaKind = [
    {
      kind: "Bilder",
      count: imageCountInPeriod,
      fill: "var(--chart-1)",
    },
    {
      kind: "Videos",
      count: videoCountInPeriod,
      fill: "var(--chart-4)",
    },
  ].filter((row) => row.count > 0);

  const monthCounts = new Map<string, number>();
  for (const item of periodItems) {
    const key = monthKey(item.created_at);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const byMonth = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({
      month: formatMonthLabel(key),
      count,
    }));

  const weekdayCounts = new Map<number, number>();
  for (const item of periodItems) {
    const d = new Date(item.created_at).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  const externalCachedTotal = input.syncRows.reduce(
    (sum, row) => sum + row.item_count,
    0,
  );

  return {
    totalItemsInPeriod: periodItems.length,
    totalItemsAll: input.items.length,
    gwadaItemsInPeriod,
    externalItemsInPeriod,
    imageCountInPeriod,
    videoCountInPeriod,
    storageUsedBytes,
    storageAddedInPeriodBytes,
    highlightsTotal: input.highlights.length,
    highlightsCreatedInPeriod,
    avgItemsPerHighlight,
    topPlatform,
    topCategory,
    externalCachedTotal,
    byPlatform,
    byCategory,
    byMediaKind,
    byMonth,
    byWeekday,
  };
}
