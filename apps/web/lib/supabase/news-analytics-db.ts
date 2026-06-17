import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { NewsStatsPeriod } from "@/lib/news/compute-news-statistics";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { startOfLocalDay } from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type NewsPlatformSyncAnalyticsRow = {
  platform: NewsPlatform;
  item_count: number;
  synced_at: string | null;
  last_error: string | null;
};

export type NewsStatisticsBundle = {
  items: UnifiedNewsItem[];
  syncRows: NewsPlatformSyncAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

const GWADA_SELECT =
  "id, title, body, status, created_at, published_at, scheduled_at, media";

function periodRange(monthsBack: NewsStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = startOfLocalDay(new Date());
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return { periodStart, periodEnd };
}

function parseCachedItem(raw: unknown): UnifiedNewsItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.body !== "string") return null;
  return raw as UnifiedNewsItem;
}

function mapGwadaPost(raw: Record<string, unknown>): UnifiedNewsItem {
  const status = raw.status as UnifiedNewsItem["status"];
  const media = Array.isArray(raw.media) ? raw.media : [];
  return {
    id: `gwada:${raw.id as string}`,
    platform: "gwada",
    source: "gwada",
    postId: raw.id as string,
    title: (raw.title as string | null) ?? null,
    body: (raw.body as string) ?? "",
    media: media as UnifiedNewsItem["media"],
    createdAt: raw.created_at as string,
    publishedAt: (raw.published_at as string | null) ?? null,
    scheduledAt: (raw.scheduled_at as string | null) ?? null,
    status,
    canEdit: status !== "archived",
    canDelete: true,
    externalUrl: null,
    insights: null,
    authorName: null,
  };
}

export async function fetchNewsStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: NewsStatsPeriod;
}): Promise<{ data: NewsStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd } = periodRange(months);
  const sb = createSupabaseBrowserClient();

  const [gwadaRes, cacheRes, syncRes] = await Promise.all([
    sb
      .from("gwada_news_posts")
      .select(GWADA_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: true }),
    sb
      .from("restaurant_news_platform_cache")
      .select("item, published_at, platform")
      .eq("restaurant_id", params.restaurantId),
    sb
      .from("restaurant_news_platform_sync")
      .select("platform, item_count, synced_at, last_error")
      .eq("restaurant_id", params.restaurantId),
  ]);

  const error =
    gwadaRes.error?.message ??
    cacheRes.error?.message ??
    syncRes.error?.message ??
    null;
  if (error) {
    return { data: null, error };
  }

  const gwadaItems = (gwadaRes.data ?? []).map((raw) =>
    mapGwadaPost(raw as Record<string, unknown>),
  );

  const cachedItems: UnifiedNewsItem[] = [];
  for (const row of cacheRes.data ?? []) {
    const parsed = parseCachedItem(row.item);
    if (!parsed) continue;
    const rowPublishedAt = row.published_at as string | null | undefined;
    if (rowPublishedAt && !parsed.publishedAt) {
      parsed.publishedAt = rowPublishedAt;
    }
    cachedItems.push(parsed);
  }

  const syncRows: NewsPlatformSyncAnalyticsRow[] = (syncRes.data ?? []).map(
    (raw) => {
      const row = raw as Record<string, unknown>;
      return {
        platform: row.platform as NewsPlatform,
        item_count: Number(row.item_count ?? 0),
        synced_at: (row.synced_at as string | null) ?? null,
        last_error: (row.last_error as string | null) ?? null,
      };
    },
  );

  return {
    data: {
      items: [...gwadaItems, ...cachedItems],
      syncRows,
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
