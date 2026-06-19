import "server-only";

import {
  isNewsStoriesPlatform,
  type NewsStoriesPlatform,
} from "@/lib/news/news-stories-cache-constants";
import { normalizeInstagramNewsMediaProxyUrl } from "@/lib/news/connectors/instagram-media-map";
import type { UnifiedNewsStorySlide } from "@/lib/news/unified-news-story";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsStoriesPlatformSyncRow = {
  platform: NewsStoriesPlatform;
  synced_at: string | null;
  last_error: string | null;
  item_count: number;
};

function parseCachedSlide(raw: unknown): UnifiedNewsStorySlide | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.url !== "string") return null;
  if (o.kind !== "image" && o.kind !== "video") return null;
  return raw as UnifiedNewsStorySlide;
}

function normalizeCachedStorySlideUrl(slide: UnifiedNewsStorySlide): UnifiedNewsStorySlide {
  if (slide.platform !== "instagram") return slide;
  const normalized = normalizeInstagramNewsMediaProxyUrl(slide.url);
  return normalized === slide.url ? slide : { ...slide, url: normalized };
}

export function externalIdFromStorySlide(slide: UnifiedNewsStorySlide): string {
  const prefix = `${slide.platform}:`;
  if (slide.id.startsWith(prefix)) return slide.id.slice(prefix.length);
  return slide.id;
}

export async function readNewsStoriesPlatformSyncState(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: NewsStoriesPlatform[],
): Promise<NewsStoriesPlatformSyncRow[]> {
  let query = sb
    .from("restaurant_news_stories_sync")
    .select("platform, synced_at, last_error, item_count")
    .eq("restaurant_id", restaurantId);

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] news stories sync state read", error.message);
    return [];
  }

  return (data ?? [])
    .filter(
      (row): row is NewsStoriesPlatformSyncRow =>
        typeof row.platform === "string" &&
        isNewsStoriesPlatform(row.platform as NewsStoriesPlatform),
    )
    .map((row) => ({
      platform: row.platform as NewsStoriesPlatform,
      synced_at: (row.synced_at as string | null) ?? null,
      last_error: (row.last_error as string | null) ?? null,
      item_count: Number(row.item_count ?? 0),
    }));
}

export async function readCachedNewsStorySlides(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: NewsStoriesPlatform[],
): Promise<UnifiedNewsStorySlide[]> {
  let query = sb
    .from("restaurant_news_stories_cache")
    .select("story, published_at, expires_at")
    .eq("restaurant_id", restaurantId)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] news stories cache read", error.message);
    return [];
  }

  const slides: UnifiedNewsStorySlide[] = [];
  const now = Date.now();

  for (const row of data ?? []) {
    const slide = parseCachedSlide(row.story);
    if (!slide) continue;
    if (slide.expiresAt && new Date(slide.expiresAt).getTime() < now) continue;
    const rowPublishedAt = row.published_at as string | null | undefined;
    if (rowPublishedAt && !slide.publishedAt) {
      slide.publishedAt = rowPublishedAt;
    }
    const rowExpiresAt = row.expires_at as string | null | undefined;
    if (rowExpiresAt && !slide.expiresAt) {
      slide.expiresAt = rowExpiresAt;
    }
    slides.push(normalizeCachedStorySlideUrl(slide));
  }

  return slides;
}

export async function upsertNewsStoriesPlatformCache(
  admin: SupabaseClient,
  restaurantId: string,
  platform: NewsStoriesPlatform,
  slides: UnifiedNewsStorySlide[],
  syncedAt: string,
  lastError: string | null,
): Promise<void> {
  const seenExternalIds = new Set<string>();
  const now = syncedAt;

  if (slides.length > 0) {
    const rows = slides.map((slide) => {
      const externalId = externalIdFromStorySlide(slide);
      seenExternalIds.add(externalId);
      return {
        restaurant_id: restaurantId,
        platform,
        external_id: externalId,
        story: slide,
        published_at: slide.publishedAt,
        expires_at: slide.expiresAt,
        fetched_at: now,
      };
    });

    const { error: upsertError } = await admin
      .from("restaurant_news_stories_cache")
      .upsert(rows, { onConflict: "restaurant_id,platform,external_id" });

    if (upsertError) {
      console.warn("[gwada] news stories cache upsert", platform, upsertError.message);
    }
  }

  const { data: existing } = await admin
    .from("restaurant_news_stories_cache")
    .select("external_id")
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform);

  const staleIds = (existing ?? [])
    .map((row) => row.external_id as string)
    .filter((id) => !seenExternalIds.has(id));

  if (staleIds.length > 0) {
    await admin
      .from("restaurant_news_stories_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform)
      .in("external_id", staleIds);
  }

  if (slides.length === 0) {
    await admin
      .from("restaurant_news_stories_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform);
  }

  await admin.from("restaurant_news_stories_sync").upsert(
    {
      restaurant_id: restaurantId,
      platform,
      synced_at: now,
      last_error: lastError,
      item_count: slides.length,
    },
    { onConflict: "restaurant_id,platform" },
  );
}
