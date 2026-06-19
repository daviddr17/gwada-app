import "server-only";

import type { NewsPlatformConnector } from "@/lib/news/connectors/types";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import {
  getGoogleBusinessAccessTokenForRestaurant,
  googleReviewsParentPath,
} from "@/lib/integrations/google-business-access";

const CAPABILITIES = {
  canReadFeed: true,
  canReadStories: false,
  canCreatePost: true,
  canPublishStory: false,
  canUpdatePost: true,
  canDeletePost: true,
  canReadInsights: false,
  supportsNativeScheduling: false,
  supportsVideo: false,
  maxMediaCount: 1,
} as const;

type GoogleLocalPost = {
  name?: string;
  summary?: string;
  createTime?: string;
  updateTime?: string;
  state?: string;
  searchUrl?: string;
  media?: Array<{ googleUrl?: string }>;
};

async function getGoogleLocation(restaurantId: string) {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) return { error: auth.error as string };
  const parent = googleReviewsParentPath(auth.config);
  if (!parent) return { error: "google_location_missing" };
  return { accessToken: auth.accessToken, parent };
}

export const googleBusinessNewsConnector: NewsPlatformConnector = {
  key: "google_business",
  displayName: "Google Business",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getGoogleLocation(restaurantId);
    return !("error" in auth);
  },
  async fetchFeed(restaurantId) {
    const auth = await getGoogleLocation(restaurantId);
    if ("error" in auth) return { error: auth.error ?? "google_not_connected" };
    const url = `https://mybusiness.googleapis.com/v4/${auth.parent}/localPosts`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
    });
    const body = (await res.json()) as {
      localPosts?: GoogleLocalPost[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { error: body.error?.message ?? `google_local_posts_${res.status}` };
    }
    const items: UnifiedNewsItem[] = (body.localPosts ?? []).map((post) => {
      const id = post.name?.split("/").pop() ?? post.name ?? "";
      return {
        id: `google_business:${id}`,
        platform: "google_business",
        source: "external",
        postId: null,
        title: null,
        body: post.summary?.trim() ?? "",
        media: post.media?.[0]?.googleUrl
          ? [
              {
                id: `${id}-media`,
                kind: "image" as const,
                url: post.media[0].googleUrl,
                storagePath: null,
                mimeType: "image/jpeg",
                sortOrder: 0,
              },
            ]
          : [],
        createdAt: post.createTime ?? new Date().toISOString(),
        publishedAt: post.createTime ?? null,
        scheduledAt: null,
        status: post.state === "REJECTED" ? "failed" : "published",
        canEdit: true,
        canDelete: true,
        externalUrl: post.searchUrl ?? null,
        insights: null,
        authorName: null,
      };
    });
    return { items: items.filter((i) => i.body || i.media.length) };
  },
  async publishPost(restaurantId, _sb, input) {
    const auth = await getGoogleLocation(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "google_not_connected" };
    const summary = [input.title?.trim(), input.body.trim()].filter(Boolean).join("\n\n");
    const imageUrl = input.mediaUrls[0];
    const payload: Record<string, unknown> = {
      languageCode: "de",
      summary,
      topicType: "STANDARD",
    };
    if (imageUrl) {
      payload.media = [{ mediaFormat: "PHOTO", sourceUrl: imageUrl }];
    }
    const url = `https://mybusiness.googleapis.com/v4/${auth.parent}/localPosts`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = (await res.json()) as GoogleLocalPost & { error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, error: body.error?.message ?? `google_publish_${res.status}` };
    }
    const externalId = body.name?.split("/").pop() ?? body.name ?? null;
    return {
      ok: true,
      externalId,
      externalUrl: body.searchUrl ?? null,
      publishedAt: body.createTime ?? new Date().toISOString(),
    };
  },
  externalEditUrl(_externalId) {
    return "https://business.google.com/";
  },
};
