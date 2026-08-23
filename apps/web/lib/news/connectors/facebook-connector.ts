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
  parseFacebookPostForNews,
  type FbPostForNews,
} from "@/lib/news/connectors/facebook-post-content";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadFeed: true,
  canReadStories: true,
  canCreatePost: true,
  canPublishStory: true,
  canUpdatePost: true,
  canDeletePost: true,
  canReadInsights: true,
  supportsNativeScheduling: false,
  supportsVideo: true,
  maxMediaCount: 10,
} as const;

const FB_ATTACHMENT_FIELDS =
  "attachments{type,title,description,url,unshimmed_url,media_type,media{image{src},source},target{id,url},subattachments{type,title,description,media{image{src}}}}";

const FB_POST_FIELDS = [
  "id",
  "message",
  "story",
  "created_time",
  "permalink_url",
  "full_picture",
  "picture",
  FB_ATTACHMENT_FIELDS,
].join(",");

async function fetchFacebookPosts(auth: { pageId: string; token: string }) {
  const attempts = [
    `${auth.pageId}/published_posts?fields=${encodeURIComponent(FB_POST_FIELDS)}&limit=50`,
    `${auth.pageId}/feed?fields=${encodeURIComponent(FB_POST_FIELDS)}&limit=50`,
    `${auth.pageId}/published_posts?fields=${encodeURIComponent("id,message,created_time,permalink_url,full_picture,picture")}&limit=50`,
    `${auth.pageId}/published_posts?fields=${encodeURIComponent("id,message,created_time,permalink_url,full_picture")}&limit=50`,
    `${auth.pageId}/published_posts?fields=${encodeURIComponent("id,message,created_time,permalink_url")}&limit=50`,
    `${auth.pageId}/feed?fields=${encodeURIComponent("id,message,created_time,permalink_url,attachments{media{image{src}}}")}&limit=50`,
  ];
  let lastError: string | null = null;
  for (const path of attempts) {
    const result = await metaGraphListFetch<FbPostForNews>({
      path,
      token: auth.token,
      context: { platform: "facebook", feature: "news" },
    });
    if (result.ok) return result;
    lastError = result.error;
  }
  return { ok: false as const, error: lastError ?? "facebook_posts_failed" };
}

function mapFacebookPostToNewsItem(post: FbPostForNews): UnifiedNewsItem {
  const parsed = parseFacebookPostForNews(post);
  return {
    id: `facebook:${post.id}`,
    platform: "facebook",
    source: "external",
    postId: null,
    title: parsed.title,
    body: parsed.body,
    media: parsed.mediaUrl
      ? [
          {
            id: post.id ?? "img",
            kind: "image",
            url: parsed.mediaUrl,
            thumbUrl: parsed.thumbUrl,
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
    externalUrl: parsed.externalUrl,
    insights: {
      likes: post.likes?.summary?.total_count,
      comments: post.comments?.summary?.total_count,
    },
    authorName: null,
  };
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
    const items = fetched.data.map(mapFacebookPostToNewsItem);
    return {
      items: items.filter((i) => i.body || i.media.length > 0 || i.title),
    };
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
