import "server-only";

import type { NewsPlatform } from "@/lib/constants/news-platforms";
import {
  isNewsCacheablePlatform,
  type NewsCacheablePlatform,
} from "@/lib/news/news-cache-constants";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsPlatformSyncRow = {
  platform: NewsCacheablePlatform;
  synced_at: string | null;
  last_error: string | null;
  item_count: number;
};

export function externalIdFromNewsItem(item: UnifiedNewsItem): string {
  const prefix = `${item.platform}:`;
  if (item.id.startsWith(prefix)) return item.id.slice(prefix.length);
  return item.id;
}

function parseCachedItem(raw: unknown): UnifiedNewsItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.body !== "string") return null;
  return raw as UnifiedNewsItem;
}

export async function readNewsPlatformSyncState(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: NewsCacheablePlatform[],
): Promise<NewsPlatformSyncRow[]> {
  let query = sb
    .from("restaurant_news_platform_sync")
    .select("platform, synced_at, last_error, item_count")
    .eq("restaurant_id", restaurantId);

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] news sync state read", error.message);
    return [];
  }

  return (data ?? [])
    .filter(
      (row): row is NewsPlatformSyncRow =>
        typeof row.platform === "string" &&
        isNewsCacheablePlatform(row.platform as NewsPlatform),
    )
    .map((row) => ({
      platform: row.platform as NewsCacheablePlatform,
      synced_at: (row.synced_at as string | null) ?? null,
      last_error: (row.last_error as string | null) ?? null,
      item_count: Number(row.item_count ?? 0),
    }));
}

export async function readCachedNewsItems(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: NewsCacheablePlatform[],
): Promise<UnifiedNewsItem[]> {
  let query = sb
    .from("restaurant_news_platform_cache")
    .select("item, published_at")
    .eq("restaurant_id", restaurantId)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] news cache read", error.message);
    return [];
  }

  const items: UnifiedNewsItem[] = [];
  for (const row of data ?? []) {
    const item = parseCachedItem(row.item);
    if (item) items.push(item);
  }
  return items;
}

export async function upsertNewsPlatformCache(
  admin: SupabaseClient,
  restaurantId: string,
  platform: NewsCacheablePlatform,
  items: UnifiedNewsItem[],
  syncedAt: string,
  lastError: string | null,
): Promise<void> {
  const seenExternalIds = new Set<string>();
  const now = syncedAt;

  if (items.length > 0) {
    const rows = items.map((item) => {
      const externalId = externalIdFromNewsItem(item);
      seenExternalIds.add(externalId);
      return {
        restaurant_id: restaurantId,
        platform,
        external_id: externalId,
        item,
        published_at: item.publishedAt ?? item.createdAt,
        fetched_at: now,
      };
    });

    const { error: upsertError } = await admin
      .from("restaurant_news_platform_cache")
      .upsert(rows, { onConflict: "restaurant_id,platform,external_id" });

    if (upsertError) {
      console.warn("[gwada] news cache upsert", platform, upsertError.message);
    }
  }

  const { data: existing } = await admin
    .from("restaurant_news_platform_cache")
    .select("external_id")
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform);

  const staleIds = (existing ?? [])
    .map((row) => row.external_id as string)
    .filter((id) => !seenExternalIds.has(id));

  if (staleIds.length > 0) {
    await admin
      .from("restaurant_news_platform_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform)
      .in("external_id", staleIds);
  }

  if (items.length === 0) {
    await admin
      .from("restaurant_news_platform_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform);
  }

  await admin.from("restaurant_news_platform_sync").upsert(
    {
      restaurant_id: restaurantId,
      platform,
      synced_at: now,
      last_error: lastError,
      item_count: items.length,
    },
    { onConflict: "restaurant_id,platform" },
  );
}
