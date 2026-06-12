import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import type { NewsPlatformConnector } from "@/lib/news/connectors/types";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { metaGraphListFetch } from "@/lib/news/connectors/meta-feed-fetch";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadFeed: true,
  canCreatePost: true,
  canUpdatePost: true,
  canDeletePost: true,
  canReadInsights: true,
  supportsNativeScheduling: false,
  supportsVideo: true,
  maxMediaCount: 10,
} as const;

type FbPost = {
  id?: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: {
    data?: Array<{
      media?: { image?: { src?: string } };
    }>;
  };
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};

function fbPostImage(post: FbPost): string | null {
  return (
    post.full_picture?.trim() ||
    post.attachments?.data?.[0]?.media?.image?.src?.trim() ||
    null
  );
}

async function fetchFacebookPosts(auth: { pageId: string; token: string }) {
  const attempts = [
    `${auth.pageId}/published_posts?fields=${encodeURIComponent("id,message,created_time,permalink_url,full_picture")}&limit=50`,
    `${auth.pageId}/published_posts?fields=${encodeURIComponent("id,message,created_time,permalink_url")}&limit=50`,
    `${auth.pageId}/feed?fields=${encodeURIComponent("id,message,created_time,permalink_url,attachments{media{image{src}}}")}&limit=50`,
  ];
  let lastError: string | null = null;
  for (const path of attempts) {
    const result = await metaGraphListFetch<FbPost>({
      path,
      token: auth.token,
      context: { platform: "facebook", feature: "news" },
    });
    if (result.ok) return result;
    lastError = result.error;
  }
  return { ok: false as const, error: lastError ?? "facebook_posts_failed" };
}

async function getMetaAuth(restaurantId: string) {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return { error: "facebook_not_connected" as const };
  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) return { error: "facebook_token_missing" as const };
  return {
    pageId,
    token,
  };
}

export const facebookNewsConnector: NewsPlatformConnector = {
  key: "facebook",
  displayName: "Facebook",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getMetaAuth(restaurantId);
    return !("error" in auth);
  },
  async fetchFeed(restaurantId) {
    const auth = await getMetaAuth(restaurantId);
    if ("error" in auth) return { error: auth.error ?? "facebook_not_connected" };
    const fetched = await fetchFacebookPosts(auth);
    if (!fetched.ok) return { error: fetched.error };
    const items: UnifiedNewsItem[] = fetched.data.map((post) => {
      const imageUrl = fbPostImage(post);
      return {
      id: `facebook:${post.id}`,
      platform: "facebook",
      source: "external",
      postId: null,
      title: null,
      body: post.message?.trim() ?? "",
      media: imageUrl
        ? [
            {
              id: post.id ?? "img",
              kind: "image",
              url: imageUrl,
              storagePath: null,
              mimeType: "image/jpeg",
              sortOrder: 0,
            },
          ]
        : [],
      createdAt: post.created_time ?? new Date().toISOString(),
      publishedAt: post.created_time ?? null,
      scheduledAt: null,
      status: "published",
      canEdit: true,
      canDelete: true,
      externalUrl: post.permalink_url ?? null,
      insights: {
        likes: post.likes?.summary?.total_count,
        comments: post.comments?.summary?.total_count,
      },
      authorName: null,
    };
    });
    return { items: items.filter((i) => i.body || i.media.length) };
  },
  async publishPost(restaurantId, _sb, input) {
    const auth = await getMetaAuth(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "facebook_not_connected" };
    const message = [input.title?.trim(), input.body.trim()].filter(Boolean).join("\n\n");
    const imageUrl = input.mediaUrls[0];
    const url = imageUrl
      ? `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.pageId}/photos`
      : `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.pageId}/feed`;
    const payload = imageUrl ? { url: imageUrl, caption: message } : { message };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !body.id) {
      return { ok: false, error: body.error?.message ?? `facebook_publish_${res.status}` };
    }
    return {
      ok: true,
      externalId: body.id,
      externalUrl: `https://www.facebook.com/${body.id}`,
      publishedAt: new Date().toISOString(),
    };
  },
  externalEditUrl(externalId) {
    if (!externalId) return "https://business.facebook.com/";
    return `https://www.facebook.com/${externalId}`;
  },
};
