import "server-only";

import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { publishFacebookStory } from "@/lib/news/connectors/facebook-stories";
import { publishInstagramStory } from "@/lib/news/connectors/instagram-stories";
import { getNewsConnector } from "@/lib/news/connectors/registry";
import { syncRestaurantNewsPlatformAfterPublish } from "@/lib/news/news-feed-sync-server";
import {
  isNewsStoriesPlatform,
  type NewsStoriesPlatform,
} from "@/lib/news/news-stories-cache-constants";
import { syncRestaurantNewsStoriesAfterPublish } from "@/lib/news/news-stories-sync-server";
import type { NewsPublishInput } from "@/lib/news/connectors/types";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import {
  parseNewsMedia,
  resolveNewsMediaSignedUrls,
  type NewsMediaRow,
} from "@/lib/news/news-media";
import type { SupabaseClient } from "@supabase/supabase-js";

async function publishNewsStories(
  restaurantId: string,
  storyPlatforms: NewsStoriesPlatform[],
  mediaUrls: string[],
  mediaKinds: Array<"image" | "video">,
): Promise<void> {
  if (storyPlatforms.length === 0 || mediaUrls.length === 0) return;

  const firstUrl = mediaUrls[0];
  const firstKind = mediaKinds[0] ?? "image";
  const storyInput =
    firstKind === "video"
      ? { videoUrl: firstUrl }
      : { imageUrl: firstUrl };

  for (const platform of storyPlatforms) {
    if (!isNewsStoriesPlatform(platform)) continue;
    const connector = getNewsConnector(platform);
    if (!connector.capabilities.canPublishStory) continue;

    if (platform === "instagram") {
      const row = await fetchRestaurantOAuthIntegrationAdmin(
        restaurantId,
        "instagram",
        (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
      );
      const igId = row?.config.instagram_business_account_id?.trim();
      const token = row?.config.page_access_token?.trim();
      if (!igId || !token) continue;
      const result = await publishInstagramStory({ igId, token }, storyInput);
      if (result.ok) {
        void syncRestaurantNewsStoriesAfterPublish(restaurantId, platform);
      }
      continue;
    }

    const row = await fetchRestaurantOAuthIntegrationAdmin(
      restaurantId,
      "facebook",
      (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
    );
    const pageId = row?.config.page_id?.trim();
    const token = row?.config.page_access_token?.trim();
    if (!pageId || !token) continue;
    const result = await publishFacebookStory({ pageId, token }, storyInput);
    if (result.ok) {
      void syncRestaurantNewsStoriesAfterPublish(restaurantId, platform);
    }
  }
}

export async function createAndPublishNewsPost(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    postId?: string;
    title: string | null;
    body: string;
    media: NewsMediaRow[];
    scheduledAt: string | null;
    platforms: NewsPlatform[];
    storyPlatforms?: NewsStoriesPlatform[];
  },
): Promise<
  | { ok: true; postId: string }
  | { ok: false; error: string }
> {
  const isScheduled =
    params.scheduledAt != null &&
    new Date(params.scheduledAt).getTime() > Date.now() + 30_000;

  const mediaJson = params.media.map((m) => ({
    id: m.id,
    kind: m.kind,
    storagePath: m.storagePath,
    mimeType: m.mimeType,
    sortOrder: m.sortOrder,
  }));

  const insertRow: Record<string, unknown> = {
    restaurant_id: params.restaurantId,
    title: params.title,
    body: params.body,
    media: mediaJson,
    status: isScheduled ? "scheduled" : "draft",
    scheduled_at: isScheduled ? params.scheduledAt : null,
    created_by: params.userId,
    updated_by: params.userId,
  };
  if (params.postId) insertRow.id = params.postId;

  const { data: post, error: postError } = await sb
    .from("gwada_news_posts")
    .insert(insertRow)
    .select("id")
    .single();

  if (postError || !post) {
    return { ok: false, error: postError?.message ?? "post_create_failed" };
  }

  const postId = post.id as string;
  const publishPlatforms = params.platforms.length ? params.platforms : (["gwada"] as NewsPlatform[]);
  const mediaStoragePaths = parseNewsMedia(mediaJson).map((m) => m.storagePath);
  const mediaUrls = isScheduled
    ? []
    : await resolveNewsMediaSignedUrls(mediaStoragePaths);

  for (const platform of publishPlatforms) {
    const connector = getNewsConnector(platform);
    const pubInput: NewsPublishInput = {
      title: params.title,
      body: params.body,
      mediaStoragePaths,
      mediaUrls,
      scheduledAt: params.scheduledAt,
    };

    await sb.from("gwada_news_publications").upsert(
      {
        post_id: postId,
        restaurant_id: params.restaurantId,
        platform,
        status: isScheduled ? "scheduled" : "pending",
        scheduled_at: isScheduled ? params.scheduledAt : null,
      },
      { onConflict: "post_id,platform" },
    );

    if (isScheduled) continue;

    if (platform === "gwada") {
      await sb
        .from("gwada_news_publications")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("post_id", postId)
        .eq("platform", platform);
      continue;
    }

    if (!connector.publishPost) {
      await sb
        .from("gwada_news_publications")
        .update({ status: "failed", last_error: "publish_not_supported" })
        .eq("post_id", postId)
        .eq("platform", platform);
      continue;
    }

    const result = await connector.publishPost(params.restaurantId, sb, pubInput);
    if (!result.ok) {
      await sb
        .from("gwada_news_publications")
        .update({ status: "failed", last_error: result.error })
        .eq("post_id", postId)
        .eq("platform", platform);
      continue;
    }

    await sb
      .from("gwada_news_publications")
      .update({
        status: "published",
        external_id: result.externalId,
        external_url: result.externalUrl,
        published_at: result.publishedAt ?? new Date().toISOString(),
        last_error: null,
      })
      .eq("post_id", postId)
      .eq("platform", platform);

    void syncRestaurantNewsPlatformAfterPublish(params.restaurantId, platform);
  }

  if (!isScheduled && params.storyPlatforms?.length && mediaUrls.length > 0) {
    await publishNewsStories(
      params.restaurantId,
      params.storyPlatforms,
      mediaUrls,
      parseNewsMedia(mediaJson).map((m) => m.kind),
    );
  }

  if (!isScheduled) {
    const hasGwada = publishPlatforms.includes("gwada");
    if (hasGwada) {
      await sb
        .from("gwada_news_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          updated_by: params.userId,
        })
        .eq("id", postId);
    } else {
      const { data: pubs } = await sb
        .from("gwada_news_publications")
        .select("status")
        .eq("post_id", postId);
      const anyPublished = (pubs ?? []).some((p) => p.status === "published");
      await sb
        .from("gwada_news_posts")
        .update({
          status: anyPublished ? "published" : "failed",
          published_at: anyPublished ? new Date().toISOString() : null,
          updated_by: params.userId,
        })
        .eq("id", postId);
    }
  }

  return { ok: true, postId };
}

export async function publishNewsPostToPlatforms(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    postId: string;
    title: string | null;
    body: string;
    media: unknown;
    platforms: NewsPlatform[];
  },
): Promise<{ published: number; failed: number }> {
  const mediaRows = parseNewsMedia(params.media);
  const mediaStoragePaths = mediaRows.map((m) => m.storagePath);
  const mediaUrls = await resolveNewsMediaSignedUrls(mediaStoragePaths);
  let published = 0;
  let failed = 0;

  for (const platform of params.platforms) {
    const connector = getNewsConnector(platform);
    const pubInput: NewsPublishInput = {
      title: params.title,
      body: params.body,
      mediaStoragePaths,
      mediaUrls,
      scheduledAt: null,
    };

    if (platform === "gwada") {
      await sb
        .from("gwada_news_publications")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("post_id", params.postId)
        .eq("platform", platform);
      published += 1;
      continue;
    }

    if (!connector.publishPost) {
      await sb
        .from("gwada_news_publications")
        .update({ status: "failed", last_error: "publish_not_supported" })
        .eq("post_id", params.postId)
        .eq("platform", platform);
      failed += 1;
      continue;
    }

    const result = await connector.publishPost(params.restaurantId, sb, pubInput);
    if (!result.ok) {
      await sb
        .from("gwada_news_publications")
        .update({ status: "failed", last_error: result.error })
        .eq("post_id", params.postId)
        .eq("platform", platform);
      failed += 1;
      continue;
    }

    await sb
      .from("gwada_news_publications")
      .update({
        status: "published",
        external_id: result.externalId,
        external_url: result.externalUrl,
        published_at: result.publishedAt ?? new Date().toISOString(),
        last_error: null,
      })
      .eq("post_id", params.postId)
      .eq("platform", platform);
    void syncRestaurantNewsPlatformAfterPublish(params.restaurantId, platform);
    published += 1;
  }

  return { published, failed };
}
