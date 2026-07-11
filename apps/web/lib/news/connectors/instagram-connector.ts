import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import type { NewsPlatformConnector } from "@/lib/news/connectors/types";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { metaGraphListFetch } from "@/lib/news/connectors/meta-feed-fetch";
import {
  IG_MEDIA_FIELDS_BASIC,
  IG_MEDIA_FIELDS_EXTENDED,
  igMediaKind,
  igMediaPreviewUrl,
  type IgMedia,
} from "@/lib/news/connectors/instagram-media-map";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadFeed: true,
  canReadStories: true,
  canCreatePost: true,
  canPublishStory: true,
  canUpdatePost: false,
  canDeletePost: true,
  canReadInsights: true,
  supportsNativeScheduling: false,
  supportsVideo: true,
  maxMediaCount: 10,
} as const;

async function getIgAuth(restaurantId: string) {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "instagram",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return { error: "instagram_not_connected" as const };
  const igId = row.config.instagram_business_account_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!igId || !token) return { error: "instagram_token_missing" as const };
  return { igId, token };
}

function mapIgMediaToNewsItem(media: IgMedia): UnifiedNewsItem {
  const previewUrl = igMediaPreviewUrl(media);
  const kind = igMediaKind(media);
  return {
    id: `instagram:${media.id}`,
    platform: "instagram",
    source: "external",
    postId: null,
    title: null,
    body: media.caption?.trim() ?? "",
    media: previewUrl
      ? [
          {
            id: media.id ?? "media",
            kind,
            url: previewUrl,
            storagePath: null,
            mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
            sortOrder: 0,
          },
        ]
      : [],
    createdAt: media.timestamp ?? new Date().toISOString(),
    publishedAt: media.timestamp ?? null,
    scheduledAt: null,
    status: "published",
    canEdit: false,
    canDelete: true,
    externalUrl: media.permalink ?? null,
    insights: {
      likes: media.like_count,
      comments: media.comments_count,
    },
    authorName: null,
  };
}

async function fetchInstagramMedia(auth: { igId: string; token: string }) {
  const attempts = [IG_MEDIA_FIELDS_EXTENDED, IG_MEDIA_FIELDS_BASIC];
  let lastError: string | null = null;

  for (const fields of attempts) {
    const result = await metaGraphListFetch<IgMedia>({
      path: `${auth.igId}/media?fields=${encodeURIComponent(fields)}&limit=50`,
      token: auth.token,
      context: { platform: "instagram", feature: "news" },
    });
    if (result.ok) {
      return { ok: true as const, data: result.data };
    }
    lastError = result.error;
  }

  return { ok: false as const, error: lastError ?? "instagram_media_failed" };
}

export const instagramNewsConnector: NewsPlatformConnector = {
  key: "instagram",
  displayName: "Instagram",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getIgAuth(restaurantId);
    return !("error" in auth);
  },
  async fetchFeed(restaurantId) {
    const auth = await getIgAuth(restaurantId);
    if ("error" in auth) return { error: auth.error ?? "instagram_not_connected" };

    const fetched = await fetchInstagramMedia(auth);
    if (!fetched.ok) return { error: fetched.error };

    const items = fetched.data
      .map((m) => mapIgMediaToNewsItem(m))
      .filter((item) => item.body || item.media.length > 0 || item.externalUrl);

    return { items };
  },
  async publishPost(restaurantId, _sb, input) {
    const auth = await getIgAuth(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "instagram_not_connected" };
    const caption = [input.title?.trim(), input.body.trim()].filter(Boolean).join("\n\n");
    const imageUrl = input.mediaUrls[0];
    if (!imageUrl) {
      return { ok: false, error: "instagram_requires_image" };
    }
    const createUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.igId}/media`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        caption,
        image_url: imageUrl,
      }),
      cache: "no-store",
    });
    const createBody = (await createRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!createRes.ok || !createBody.id) {
      return {
        ok: false,
        error: createBody.error?.message ?? "instagram_publish_failed",
      };
    }
    const publishUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.igId}/media_publish`;
    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ creation_id: createBody.id }),
      cache: "no-store",
    });
    const publishBody = (await publishRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!publishRes.ok || !publishBody.id) {
      return { ok: false, error: publishBody.error?.message ?? "instagram_publish_failed" };
    }
    return {
      ok: true,
      externalId: publishBody.id,
      externalUrl: null,
      publishedAt: new Date().toISOString(),
    };
  },
  externalEditUrl(_externalId) {
    return "https://business.facebook.com/latest/instagram/posts";
  },
};
