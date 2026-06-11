import "server-only";

import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { isNewsPlatform } from "@/lib/constants/news-platforms";
import {
  publishNewsPostToPlatforms,
} from "@/lib/news/news-publish-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function processDueScheduledNewsPosts(
  sb: Awaited<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<{ processed: number; published: number; failed: number }> {
  if (!sb) return { processed: 0, published: 0, failed: 0 };

  const { data: duePosts, error } = await sb
    .from("gwada_news_posts")
    .select("id, restaurant_id, title, body, media")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error || !duePosts?.length) {
    return { processed: 0, published: 0, failed: 0 };
  }

  let published = 0;
  let failed = 0;

  for (const post of duePosts) {
    const postId = post.id as string;
    const restaurantId = post.restaurant_id as string;

    const { data: pubs } = await sb
      .from("gwada_news_publications")
      .select("platform")
      .eq("post_id", postId)
      .eq("status", "scheduled");

    const platforms = (pubs ?? [])
      .map((p) => p.platform as string)
      .filter((p): p is NewsPlatform => isNewsPlatform(p));

    const stats = await publishNewsPostToPlatforms(sb, {
      restaurantId,
      postId,
      title: (post.title as string | null) ?? null,
      body: (post.body as string) ?? "",
      media: post.media,
      platforms: platforms.length ? platforms : ["gwada"],
    });

    published += stats.published;
    failed += stats.failed;

    const postStatus = stats.published > 0 ? "published" : "failed";
    await sb
      .from("gwada_news_posts")
      .update({
        status: postStatus,
        published_at: stats.published > 0 ? new Date().toISOString() : null,
      })
      .eq("id", postId);
  }

  return { processed: duePosts.length, published, failed };
}
