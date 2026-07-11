import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { metaGraphListFetch } from "@/lib/news/connectors/meta-feed-fetch";
import {
  igMediaKind,
  igMediaPreviewUrl,
  type IgMedia,
} from "@/lib/news/connectors/instagram-media-map";
import type { UnifiedNewsStorySlide } from "@/lib/news/unified-news-story";

const IG_STORY_FIELDS = "id,media_type,media_url,thumbnail_url,timestamp,permalink";

function mapIgStoryToSlide(
  restaurantId: string,
  media: IgMedia,
): UnifiedNewsStorySlide | null {
  const previewUrl = igMediaPreviewUrl(media);
  if (!previewUrl) return null;
  const kind = igMediaKind(media);
  const publishedAt = media.timestamp ?? new Date().toISOString();
  const expiresAt = new Date(new Date(publishedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `instagram:${media.id}`,
    platform: "instagram",
    kind,
    url: previewUrl,
    caption: media.caption?.trim() ?? null,
    externalUrl: media.permalink ?? null,
    publishedAt,
    expiresAt,
  };
}

export async function fetchInstagramStories(
  restaurantId: string,
  auth: { igId: string; token: string },
): Promise<{ ok: true; slides: UnifiedNewsStorySlide[] } | { ok: false; error: string }> {
  const result = await metaGraphListFetch<IgMedia>({
    path: `${auth.igId}/stories?fields=${encodeURIComponent(IG_STORY_FIELDS)}&limit=50`,
    token: auth.token,
      context: { platform: "instagram", feature: "news" },
  });

  if (!result.ok) return { ok: false, error: result.error };

  const slides = result.data
    .map((m) => mapIgStoryToSlide(restaurantId, m))
    .filter((s): s is UnifiedNewsStorySlide => s !== null);

  return { ok: true, slides };
}

export async function publishInstagramStory(
  auth: { igId: string; token: string },
  input: { imageUrl?: string; videoUrl?: string },
): Promise<
  | { ok: true; externalId: string; publishedAt: string }
  | { ok: false; error: string }
> {
  const mediaUrl = input.videoUrl ?? input.imageUrl;
  if (!mediaUrl) return { ok: false, error: "instagram_story_requires_media" };

  const payload: Record<string, string> = {
    media_type: "STORIES",
  };
  if (input.videoUrl) payload.video_url = input.videoUrl;
  else payload.image_url = input.imageUrl!;

  const createUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.igId}/media`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const createBody = (await createRes.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!createRes.ok || !createBody.id) {
    return {
      ok: false,
      error: createBody.error?.message ?? "instagram_story_create_failed",
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
    return {
      ok: false,
      error: publishBody.error?.message ?? "instagram_story_publish_failed",
    };
  }

  return {
    ok: true,
    externalId: publishBody.id,
    publishedAt: new Date().toISOString(),
  };
}
