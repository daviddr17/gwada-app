import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import type { NewsPlatformConnector } from "@/lib/news/connectors/types";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadFeed: true,
  canCreatePost: true,
  canUpdatePost: false,
  canDeletePost: true,
  canReadInsights: true,
  supportsNativeScheduling: false,
  supportsVideo: true,
  maxMediaCount: 10,
} as const;

type IgMedia = {
  id?: string;
  caption?: string;
  timestamp?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
};

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
    const fields = [
      "id",
      "caption",
      "timestamp",
      "media_type",
      "media_url",
      "permalink",
      "like_count",
      "comments_count",
    ].join(",");
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.igId}/media?fields=${encodeURIComponent(fields)}&limit=50`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    });
    const body = (await res.json()) as { data?: IgMedia[]; error?: { message?: string } };
    if (!res.ok) return { error: body.error?.message ?? `instagram_media_${res.status}` };
    const items: UnifiedNewsItem[] = (body.data ?? []).map((m) => ({
      id: `instagram:${m.id}`,
      platform: "instagram",
      source: "external",
      postId: null,
      title: null,
      body: m.caption?.trim() ?? "",
      media: m.media_url
        ? [
            {
              id: m.id ?? "media",
              kind: m.media_type === "VIDEO" ? "video" : "image",
              url: m.media_url,
              storagePath: null,
              mimeType: m.media_type === "VIDEO" ? "video/mp4" : "image/jpeg",
              sortOrder: 0,
            },
          ]
        : [],
      createdAt: m.timestamp ?? new Date().toISOString(),
      publishedAt: m.timestamp ?? null,
      scheduledAt: null,
      status: "published",
      canEdit: false,
      canDelete: true,
      externalUrl: m.permalink ?? null,
      insights: {
        likes: m.like_count,
        comments: m.comments_count,
      },
      authorName: null,
    }));
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
