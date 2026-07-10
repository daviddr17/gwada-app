import "server-only";

import type { NewsPlatformConnector } from "@/lib/news/connectors/types";
import {
  NEWS_MEDIA_BUCKET,
  newsMediaToPreview,
  parseNewsMedia,
} from "@/lib/news/news-media";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const CAPABILITIES = {
  canReadFeed: true,
  canReadStories: false,
  canCreatePost: true,
  canPublishStory: false,
  canUpdatePost: true,
  canDeletePost: true,
  canReadInsights: false,
  supportsNativeScheduling: false,
  supportsVideo: true,
  maxMediaCount: 10,
} as const;

function mapRow(
  row: Record<string, unknown>,
  signedUrls: Map<string, string>,
): UnifiedNewsItem {
  const media = parseNewsMedia(row.media);
  const platform = "gwada" as const;
  const status = row.status as UnifiedNewsItem["status"];
  return {
    id: `gwada:${row.id as string}`,
    platform,
    source: "gwada",
    postId: row.id as string,
    title: (row.title as string | null) ?? null,
    body: (row.body as string) ?? "",
    media: newsMediaToPreview(media, signedUrls),
    createdAt: row.created_at as string,
    publishedAt: (row.published_at as string | null) ?? null,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    status,
    canEdit: status !== "archived",
    canDelete: true,
    externalUrl: null,
    insights: null,
    authorName: null,
    isPinned: Boolean(row.is_pinned),
  };
}

async function signedUrlsForMedia(
  media: ReturnType<typeof parseNewsMedia>,
): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient();
  const map = new Map<string, string>();
  if (!admin) return map;

  const paths = new Set<string>();
  for (const item of media) {
    paths.add(item.storagePath);
    if (item.thumbStoragePath) paths.add(item.thumbStoragePath);
  }

  await Promise.all(
    [...paths].map(async (path) => {
      const { data } = await admin.storage
        .from(NEWS_MEDIA_BUCKET)
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) map.set(path, data.signedUrl);
    }),
  );
  return map;
}

export const gwadaNewsConnector: NewsPlatformConnector = {
  key: "gwada",
  displayName: "Gwada",
  capabilities: CAPABILITIES,
  async isConnected() {
    return true;
  },
  async fetchFeed(restaurantId, sb) {
    const { data, error } = await sb
      .from("gwada_news_posts")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .in("status", ["published", "scheduled", "draft"])
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { error: error.message };

    const rows = data ?? [];
    const signedByRow = await Promise.all(
      rows.map(async (row) => signedUrlsForMedia(parseNewsMedia(row.media))),
    );
    const items = rows.map((row, index) =>
      mapRow(row as Record<string, unknown>, signedByRow[index]!),
    );
    return { items };
  },
  async publishPost(restaurantId, sb, input) {
    const now = new Date().toISOString();
    const isScheduled =
      input.scheduledAt != null &&
      new Date(input.scheduledAt).getTime() > Date.now();
    const { data, error } = await sb
      .from("gwada_news_posts")
      .insert({
        restaurant_id: restaurantId,
        title: input.title,
        body: input.body,
        status: isScheduled ? "scheduled" : "published",
        scheduled_at: isScheduled ? input.scheduledAt : null,
        published_at: isScheduled ? null : now,
        media: [],
      })
      .select("id, published_at")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };
    return {
      ok: true,
      externalId: data.id as string,
      externalUrl: null,
      publishedAt: (data.published_at as string | null) ?? null,
    };
  },
  externalEditUrl() {
    return null;
  },
};

export async function listGwadaNewsPostsForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<UnifiedNewsItem[]> {
  const result = await gwadaNewsConnector.fetchFeed(restaurantId, sb);
  if ("error" in result) return [];
  return result.items;
}
