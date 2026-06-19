import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { metaGraphListFetch } from "@/lib/news/connectors/meta-feed-fetch";
import type { UnifiedNewsStorySlide } from "@/lib/news/unified-news-story";

type FbStory = {
  id?: string;
  post_id?: string;
  creation_time?: string;
  media_type?: string;
  url?: string;
  media_url?: string;
  link?: string;
};

function fbStoryMediaUrl(story: FbStory): string | null {
  return story.url?.trim() || story.media_url?.trim() || null;
}

function mapFbStoryToSlide(story: FbStory): UnifiedNewsStorySlide | null {
  const mediaUrl = fbStoryMediaUrl(story);
  if (!mediaUrl || !story.id) return null;
  const publishedAt = story.creation_time ?? new Date().toISOString();
  const kind = story.media_type?.toLowerCase().includes("video") ? "video" : "image";

  return {
    id: `facebook:${story.id}`,
    platform: "facebook",
    kind,
    url: mediaUrl,
    caption: null,
    externalUrl: story.link ?? null,
    publishedAt,
    expiresAt: new Date(new Date(publishedAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function fetchFacebookStories(
  auth: { pageId: string; token: string },
): Promise<{ ok: true; slides: UnifiedNewsStorySlide[] } | { ok: false; error: string }> {
  const attempts = [
    `${auth.pageId}/stories?fields=${encodeURIComponent("id,creation_time,media_type,url,link")}&limit=50`,
    `${auth.pageId}/stories?fields=${encodeURIComponent("id,creation_time,media_url")}&limit=50`,
  ];

  let lastError: string | null = null;
  for (const path of attempts) {
    const result = await metaGraphListFetch<FbStory>({
      path,
      token: auth.token,
      context: { platform: "facebook", feature: "news" },
    });
    if (result.ok) {
      const slides = result.data
        .map(mapFbStoryToSlide)
        .filter((s): s is UnifiedNewsStorySlide => s !== null);
      return { ok: true, slides };
    }
    lastError = result.error;
  }

  return { ok: false, error: lastError ?? "facebook_stories_failed" };
}

export async function publishFacebookStory(
  auth: { pageId: string; token: string },
  input: { imageUrl?: string; videoUrl?: string },
): Promise<
  | { ok: true; externalId: string; publishedAt: string }
  | { ok: false; error: string }
> {
  if (input.videoUrl) {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.pageId}/video_stories`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_url: input.videoUrl }),
      cache: "no-store",
    });
    const body = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !body.id) {
      return { ok: false, error: body.error?.message ?? "facebook_video_story_failed" };
    }
    return { ok: true, externalId: body.id, publishedAt: new Date().toISOString() };
  }

  if (!input.imageUrl) {
    return { ok: false, error: "facebook_story_requires_media" };
  }

  const photoUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.pageId}/photos`;
  const photoRes = await fetch(photoUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: input.imageUrl, published: false }),
    cache: "no-store",
  });
  const photoBody = (await photoRes.json()) as { id?: string; error?: { message?: string } };
  if (!photoRes.ok || !photoBody.id) {
    return { ok: false, error: photoBody.error?.message ?? "facebook_story_photo_failed" };
  }

  const storyUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.pageId}/photo_stories`;
  const storyRes = await fetch(storyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ photo_id: photoBody.id }),
    cache: "no-store",
  });
  const storyBody = (await storyRes.json()) as { id?: string; error?: { message?: string } };
  if (!storyRes.ok || !storyBody.id) {
    return { ok: false, error: storyBody.error?.message ?? "facebook_photo_story_failed" };
  }

  return { ok: true, externalId: storyBody.id, publishedAt: new Date().toISOString() };
}
