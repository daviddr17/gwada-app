import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { isNewsPlatform } from "@/lib/constants/news-platforms";
import { createAndPublishNewsPost } from "@/lib/news/news-publish-server";
import type { NewsMediaRow } from "@/lib/news/news-media";
import { processDueScheduledNewsPosts } from "@/lib/news/news-scheduled-publish-cron";
import { resolveSocialSuggestionImageUrl } from "@/lib/social/social-asset-resolve-server";
import { fetchSocialBrandKitFromDb } from "@/lib/social/social-brand-kit-db";
import type { SocialTemplateId } from "@/lib/social/social-brand-kit";
import {
  captionForMultiPlatformPublish,
} from "@/lib/social/social-publish-platforms";
import {
  resolveConnectedPublishPlatforms,
  resolveConnectedStoryPlatforms,
} from "@/lib/social/social-publish-platforms-server";
import { renderAndUploadSocialTemplate } from "@/lib/social/social-template-render-server";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import {
  fetchSocialSuggestionFromDb,
  updateSocialSuggestionStatusInDb,
} from "@/lib/social/social-suggestions-db";

async function loadRestaurantPublishContext(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<{ name: string; accentHex: string }> {
  const { data } = await sb
    .from("restaurants")
    .select("name, brand_accent_hex")
    .eq("id", restaurantId)
    .maybeSingle();
  return {
    name: (typeof data?.name === "string" && data.name.trim()) || "Restaurant",
    accentHex:
      (typeof data?.brand_accent_hex === "string" &&
        data.brand_accent_hex.trim()) ||
      "#eab308",
  };
}

async function resolvePublishUserId(
  sb: SupabaseClient,
  restaurantId: string,
  preferred: string | null | undefined,
): Promise<string> {
  if (preferred && /^[0-9a-f-]{36}$/i.test(preferred)) return preferred;
  const { data } = await sb
    .from("restaurant_employees")
    .select("profile_id")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .not("profile_id", "is", null)
    .limit(1)
    .maybeSingle();
  const id = typeof data?.profile_id === "string" ? data.profile_id : "";
  return id;
}

async function renderPublishMedia(params: {
  sb: SupabaseClient;
  restaurantId: string;
  suggestionId: string;
  templateId: SocialTemplateId;
  title: string | null;
  caption: string;
  asset: SocialSuggestionAsset;
}): Promise<
  | { ok: true; media: NewsMediaRow[]; storagePath: string }
  | { ok: false; error: string }
> {
  const kit = await fetchSocialBrandKitFromDb(params.sb, params.restaurantId);
  const ctx = await loadRestaurantPublishContext(
    params.sb,
    params.restaurantId,
  );
  const rendered = await renderAndUploadSocialTemplate({
    sb: params.sb,
    restaurantId: params.restaurantId,
    suggestionId: params.suggestionId,
    templateId:
      params.templateId === "quote" ? "brand_card" : params.templateId,
    stylePreset: kit.stylePreset,
    accentHex: ctx.accentHex,
    restaurantName: ctx.name,
    title: params.title,
    caption: params.caption,
    asset: params.asset,
  });
  if (!rendered.ok) {
    // Fallback: without composed template — still need a storage path for news.
    // Instagram requires an image URL; connectors resolve from news-media paths.
    return { ok: false, error: rendered.error };
  }

  const mediaId = randomUUID();
  const media: NewsMediaRow[] = [
    {
      id: mediaId,
      kind: "image",
      storagePath: rendered.storagePath,
      mimeType: "image/jpeg",
      sortOrder: 0,
      width: 1080,
      height: 1080,
    },
  ];
  return { ok: true, media, storagePath: rendered.storagePath };
}

function platformsFromSuggestion(
  platforms: string[],
  kitPlatforms: NewsPlatform[],
): NewsPlatform[] {
  const fromSuggestion = platforms.filter(isNewsPlatform);
  if (fromSuggestion.length) return fromSuggestion;
  return kitPlatforms;
}

async function markSuggestionPublished(
  sb: SupabaseClient,
  restaurantId: string,
  suggestionId: string,
  source: Record<string, unknown>,
  caption: string,
  newsPostId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const upd = await updateSocialSuggestionStatusInDb(sb, {
    restaurantId,
    suggestionId,
    status: "approved",
    caption,
    newsPostId,
  });
  if (!upd.ok) return upd;

  const { error } = await sb
    .from("social_post_suggestions")
    .update({
      source_json: {
        ...source,
        publishedAt: new Date().toISOString(),
        schedulePublish: false,
        newsPostId,
      },
    })
    .eq("id", suggestionId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function publishSocialSuggestionNow(params: {
  sb: SupabaseClient;
  restaurantId: string;
  suggestionId: string;
  caption: string;
  userId?: string | null;
  scheduledAt?: string | null;
}): Promise<
  | { ok: true; newsPostId: string; scheduled: boolean }
  | { ok: false; error: string }
> {
  const suggestion = await fetchSocialSuggestionFromDb(
    params.sb,
    params.restaurantId,
    params.suggestionId,
  );
  if (!suggestion) return { ok: false, error: "not_found" };

  if (
    typeof suggestion.source.publishedAt === "string" &&
    suggestion.source.publishedAt &&
    !params.scheduledAt
  ) {
    return {
      ok: true,
      newsPostId: suggestion.newsPostId ?? "",
      scheduled: false,
    };
  }

  const kit = await fetchSocialBrandKitFromDb(params.sb, params.restaurantId);
  const preferred = platformsFromSuggestion(
    suggestion.platforms,
    kit.publishPlatforms,
  );
  const platforms = await resolveConnectedPublishPlatforms(
    params.restaurantId,
    preferred,
  );
  const storyPlatforms = await resolveConnectedStoryPlatforms(
    params.restaurantId,
    preferred,
    kit.publishStories,
  );

  // Instagram (Feed oder Story) braucht Bild — Render ist Pflicht
  const needsImage =
    platforms.includes("instagram") || storyPlatforms.length > 0;
  const mediaResult = await renderPublishMedia({
    sb: params.sb,
    restaurantId: params.restaurantId,
    suggestionId: params.suggestionId,
    templateId: suggestion.templateId,
    title: suggestion.title,
    caption: params.caption,
    asset: suggestion.asset,
  });

  if (!mediaResult.ok) {
    if (needsImage) return { ok: false, error: "image_required" };
    // Ohne Bild nur Text-Kanäle (Google/WhatsApp/Gwada/Facebook text)
    const withoutIg = platforms.filter((p) => p !== "instagram");
    if (!withoutIg.length) return { ok: false, error: "image_required" };
    // Return error rather than publishing without media path for FB photo posts
    // Facebook can post text-only; Google/WhatsApp too. Create post with empty media.
    const body = captionForMultiPlatformPublish(params.caption);
    const userId = await resolvePublishUserId(
      params.sb,
      params.restaurantId,
      params.userId ??
        (typeof suggestion.source.approvedBy === "string"
          ? suggestion.source.approvedBy
          : null),
    );
    const created = await createAndPublishNewsPost(params.sb, {
      restaurantId: params.restaurantId,
      userId,
      title: suggestion.title,
      body,
      media: [],
      scheduledAt: params.scheduledAt ?? null,
      platforms: withoutIg,
      storyPlatforms: [],
    });
    if (!created.ok) return { ok: false, error: created.error };
    const marked = await markSuggestionPublished(
      params.sb,
      params.restaurantId,
      params.suggestionId,
      suggestion.source,
      params.caption,
      created.postId,
    );
    if (!marked.ok) return marked;
    return {
      ok: true,
      newsPostId: created.postId,
      scheduled: Boolean(params.scheduledAt),
    };
  }

  const body = captionForMultiPlatformPublish(params.caption);
  const userId = await resolvePublishUserId(
    params.sb,
    params.restaurantId,
    params.userId ??
      (typeof suggestion.source.approvedBy === "string"
        ? suggestion.source.approvedBy
        : null),
  );

  const created = await createAndPublishNewsPost(params.sb, {
    restaurantId: params.restaurantId,
    userId,
    title: suggestion.title,
    body,
    media: mediaResult.media,
    scheduledAt: params.scheduledAt ?? null,
    platforms,
    storyPlatforms,
  });
  if (!created.ok) return { ok: false, error: created.error };

  const marked = await markSuggestionPublished(
    params.sb,
    params.restaurantId,
    params.suggestionId,
    {
      ...suggestion.source,
      publishPlatforms: platforms,
      storyPlatforms,
    },
    params.caption,
    created.postId,
  );
  if (!marked.ok) return marked;

  return {
    ok: true,
    newsPostId: created.postId,
    scheduled: Boolean(
      params.scheduledAt &&
        new Date(params.scheduledAt).getTime() > Date.now() + 30_000,
    ),
  };
}

export async function approveSocialSuggestion(params: {
  sb: SupabaseClient;
  restaurantId: string;
  suggestionId: string;
  caption?: string;
  publishNow?: boolean;
  userId?: string | null;
}): Promise<
  | { ok: true; published: boolean; errors?: string[]; platforms?: NewsPlatform[] }
  | { ok: false; error: string }
> {
  const suggestion = await fetchSocialSuggestionFromDb(
    params.sb,
    params.restaurantId,
    params.suggestionId,
  );
  if (!suggestion) return { ok: false, error: "not_found" };
  if (suggestion.status !== "pending" && suggestion.status !== "needs_asset") {
    return { ok: false, error: "invalid_status" };
  }

  const caption = (params.caption ?? suggestion.caption).trim();
  if (!caption) return { ok: false, error: "caption_required" };

  // approvedBy für späteren Cron merken
  await params.sb
    .from("social_post_suggestions")
    .update({
      source_json: {
        ...suggestion.source,
        approvedBy: params.userId ?? null,
      },
    })
    .eq("id", params.suggestionId)
    .eq("restaurant_id", params.restaurantId);

  const publishNow =
    params.publishNow === true ||
    new Date(suggestion.plannedAt).getTime() <= Date.now() + 30 * 60_000;

  if (publishNow) {
    const published = await publishSocialSuggestionNow({
      sb: params.sb,
      restaurantId: params.restaurantId,
      suggestionId: params.suggestionId,
      caption,
      userId: params.userId,
      scheduledAt: null,
    });
    if (!published.ok) return published;
    return {
      ok: true,
      published: true,
      platforms: undefined,
    };
  }

  // Geplant → direkt als News-Scheduled anlegen (alle Zielkanäle)
  const scheduled = await publishSocialSuggestionNow({
    sb: params.sb,
    restaurantId: params.restaurantId,
    suggestionId: params.suggestionId,
    caption,
    userId: params.userId,
    scheduledAt: suggestion.plannedAt,
  });
  if (!scheduled.ok) {
    // Fallback: nur Status setzen, Cron versucht später
    const freshUrl = await resolveSocialSuggestionImageUrl(
      params.sb,
      params.restaurantId,
      suggestion.asset,
    );
    if (!freshUrl && !suggestion.asset.storagePath) {
      return { ok: false, error: scheduled.error };
    }
    const upd = await updateSocialSuggestionStatusInDb(params.sb, {
      restaurantId: params.restaurantId,
      suggestionId: params.suggestionId,
      status: "approved",
      caption,
    });
    if (!upd.ok) return { ok: false, error: upd.error };
    await params.sb
      .from("social_post_suggestions")
      .update({
        source_json: {
          ...suggestion.source,
          schedulePublish: true,
          approvedBy: params.userId ?? null,
        },
      })
      .eq("id", params.suggestionId)
      .eq("restaurant_id", params.restaurantId);
    return { ok: true, published: false };
  }

  return { ok: true, published: false };
}

export async function skipSocialSuggestion(params: {
  sb: SupabaseClient;
  restaurantId: string;
  suggestionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const suggestion = await fetchSocialSuggestionFromDb(
    params.sb,
    params.restaurantId,
    params.suggestionId,
  );
  if (!suggestion) return { ok: false, error: "not_found" };
  if (suggestion.status !== "pending" && suggestion.status !== "needs_asset") {
    return { ok: false, error: "invalid_status" };
  }
  return updateSocialSuggestionStatusInDb(params.sb, {
    restaurantId: params.restaurantId,
    suggestionId: params.suggestionId,
    status: "skipped",
  });
}

/** Cron: fällige Freigaben + geplante News-Posts. */
export async function processDueApprovedSocialSuggestions(
  sb: SupabaseClient,
): Promise<{
  due: number;
  published: number;
  failed: number;
  newsScheduled: { processed: number; published: number; failed: number };
}> {
  const newsScheduled = await processDueScheduledNewsPosts(sb);

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("social_post_suggestions")
    .select("id, restaurant_id, caption, source_json, planned_at")
    .eq("status", "approved")
    .lte("planned_at", nowIso)
    .limit(40);

  if (error || !data) {
    if (error) {
      console.warn(
        "[gwada] processDueApprovedSocialSuggestions",
        error.message,
      );
    }
    return { due: 0, published: 0, failed: 0, newsScheduled };
  }

  let published = 0;
  let failed = 0;
  let due = 0;

  for (const row of data) {
    const source =
      row.source_json && typeof row.source_json === "object"
        ? (row.source_json as Record<string, unknown>)
        : {};
    if (typeof source.publishedAt === "string" && source.publishedAt) continue;
    if (typeof source.newsPostId === "string" && source.newsPostId) continue;

    due += 1;
    const restaurantId = String(row.restaurant_id ?? "");
    const suggestionId = String(row.id ?? "");
    const caption = String(row.caption ?? "").trim();
    if (!restaurantId || !suggestionId || !caption) {
      failed += 1;
      continue;
    }
    const result = await publishSocialSuggestionNow({
      sb,
      restaurantId,
      suggestionId,
      caption,
      userId:
        typeof source.approvedBy === "string" ? source.approvedBy : null,
      scheduledAt: null,
    });
    if (result.ok) published += 1;
    else failed += 1;
  }

  return { due, published, failed, newsScheduled };
}
