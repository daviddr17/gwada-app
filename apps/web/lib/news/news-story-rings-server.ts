import "server-only";

import { gwadaNewsConnector } from "@/lib/news/connectors/gwada-connector";
import { resolveNewsMediaSignedUrls } from "@/lib/news/news-media";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import type {
  UnifiedNewsStoryRing,
  UnifiedNewsStorySlide,
} from "@/lib/news/unified-news-story";
import type { SupabaseClient } from "@supabase/supabase-js";

type StoryRingRow = {
  id: string;
  title: string;
  cover_storage_path: string | null;
  sort_order: number;
};

function newsItemToStorySlide(item: UnifiedNewsItem): UnifiedNewsStorySlide | null {
  const firstMedia = item.media[0];
  if (!firstMedia?.url || !item.postId) return null;
  return {
    id: `gwada:${item.postId}`,
    platform: "gwada",
    kind: firstMedia.kind,
    url: firstMedia.url,
    caption: [item.title, item.body].filter(Boolean).join("\n\n") || null,
    externalUrl: item.externalUrl,
    publishedAt: item.publishedAt ?? item.createdAt,
    expiresAt: null,
  };
}

export async function readGwadaNewsStoryRings(
  restaurantId: string,
  sb: SupabaseClient,
): Promise<UnifiedNewsStoryRing[]> {
  const { data: rings, error } = await sb
    .from("gwada_news_story_rings")
    .select("id, title, cover_storage_path, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error || !rings?.length) return [];

  const feed = await gwadaNewsConnector.fetchFeed(restaurantId, sb);
  const postsById = new Map<string, UnifiedNewsItem>();
  if (!("error" in feed)) {
    for (const item of feed.items) {
      if (item.postId) postsById.set(item.postId, item);
    }
  }

  const result: UnifiedNewsStoryRing[] = [];

  for (const ring of rings as StoryRingRow[]) {
    const { data: links } = await sb
      .from("gwada_news_story_ring_items")
      .select("post_id, sort_order")
      .eq("ring_id", ring.id)
      .order("sort_order", { ascending: true });

    const slides: UnifiedNewsStorySlide[] = [];

    for (const link of links ?? []) {
      const postId = link.post_id as string;
      const item = postsById.get(postId);
      if (!item) continue;
      const slide = newsItemToStorySlide(item);
      if (!slide) continue;
      slides.push(slide);
    }

    let coverUrl = slides[0]?.url ?? null;
    if (!coverUrl && ring.cover_storage_path) {
      const urls = await resolveNewsMediaSignedUrls([ring.cover_storage_path]);
      coverUrl = urls[0] ?? null;
    }

    if (!coverUrl) continue;

    result.push({
      id: `gwada:${ring.id}`,
      platform: "gwada",
      title: ring.title,
      coverUrl,
      slideIds: slides.map((s) => s.id),
      slides,
    });
  }

  return result;
}
