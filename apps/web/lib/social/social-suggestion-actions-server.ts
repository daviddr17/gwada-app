import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareChannelKey } from "@/lib/constants/share-channels";
import { publishShareToChannels } from "@/lib/share/share-publish-server";
import { resolveSocialSuggestionImageUrl } from "@/lib/social/social-asset-resolve-server";
import { fetchSocialBrandKitFromDb } from "@/lib/social/social-brand-kit-db";
import type { SocialTemplateId } from "@/lib/social/social-brand-kit";
import { renderAndUploadSocialTemplate } from "@/lib/social/social-template-render-server";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import {
  fetchSocialSuggestionFromDb,
  updateSocialSuggestionStatusInDb,
} from "@/lib/social/social-suggestions-db";

function platformsToShareChannels(platforms: string[]): ShareChannelKey[] {
  const out: ShareChannelKey[] = [];
  for (const p of platforms) {
    if (p === "facebook") out.push("facebook_post");
    if (p === "instagram") out.push("instagram_post");
  }
  return out.length ? out : ["facebook_post", "instagram_post"];
}

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

async function buildPublishImageUrl(params: {
  sb: SupabaseClient;
  restaurantId: string;
  suggestionId: string;
  templateId: SocialTemplateId;
  title: string | null;
  caption: string;
  asset: SocialSuggestionAsset;
}): Promise<string | null> {
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
  if (rendered.ok) return rendered.imageUrl;

  return resolveSocialSuggestionImageUrl(
    params.sb,
    params.restaurantId,
    params.asset,
  );
}

async function markSuggestionPublished(
  sb: SupabaseClient,
  restaurantId: string,
  suggestionId: string,
  source: Record<string, unknown>,
  caption: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const upd = await updateSocialSuggestionStatusInDb(sb, {
    restaurantId,
    suggestionId,
    status: "approved",
    caption,
  });
  if (!upd.ok) return upd;

  const { error } = await sb
    .from("social_post_suggestions")
    .update({
      source_json: {
        ...source,
        publishedAt: new Date().toISOString(),
        schedulePublish: false,
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
}): Promise<{ ok: true; errors?: string[] } | { ok: false; error: string }> {
  const suggestion = await fetchSocialSuggestionFromDb(
    params.sb,
    params.restaurantId,
    params.suggestionId,
  );
  if (!suggestion) return { ok: false, error: "not_found" };

  if (
    typeof suggestion.source.publishedAt === "string" &&
    suggestion.source.publishedAt
  ) {
    return { ok: true };
  }

  const imageUrl = await buildPublishImageUrl({
    sb: params.sb,
    restaurantId: params.restaurantId,
    suggestionId: params.suggestionId,
    templateId: suggestion.templateId,
    title: suggestion.title,
    caption: params.caption,
    asset: suggestion.asset,
  });
  if (!imageUrl) return { ok: false, error: "image_required" };

  const channels = platformsToShareChannels(suggestion.platforms);
  const result = await publishShareToChannels({
    restaurantId: params.restaurantId,
    sb: params.sb,
    title: suggestion.title,
    body: params.caption,
    imageUrls: [imageUrl],
    channels,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const errors: string[] = [];
  let anyOk = false;
  for (const [channel, channelResult] of Object.entries(result.results)) {
    if (!channelResult) continue;
    if (channelResult.ok) {
      anyOk = true;
      continue;
    }
    errors.push(`${channel}: ${channelResult.error}`);
  }
  if (!anyOk) return { ok: false, error: errors[0] ?? "publish_failed" };

  const marked = await markSuggestionPublished(
    params.sb,
    params.restaurantId,
    params.suggestionId,
    suggestion.source,
    params.caption,
  );
  if (!marked.ok) return marked;

  return { ok: true, errors: errors.length ? errors : undefined };
}

export async function approveSocialSuggestion(params: {
  sb: SupabaseClient;
  restaurantId: string;
  suggestionId: string;
  caption?: string;
  publishNow?: boolean;
}): Promise<
  | { ok: true; published: boolean; errors?: string[] }
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

  const publishNow =
    params.publishNow === true ||
    new Date(suggestion.plannedAt).getTime() <= Date.now() + 30 * 60_000;

  if (publishNow) {
    const published = await publishSocialSuggestionNow({
      sb: params.sb,
      restaurantId: params.restaurantId,
      suggestionId: params.suggestionId,
      caption,
    });
    if (!published.ok) return published;
    return {
      ok: true,
      published: true,
      errors: published.errors,
    };
  }

  const freshUrl = await resolveSocialSuggestionImageUrl(
    params.sb,
    params.restaurantId,
    suggestion.asset,
  );
  if (!freshUrl && !suggestion.asset.storagePath) {
    return { ok: false, error: "image_required" };
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
      asset_json: freshUrl
        ? { ...suggestion.asset, imageUrl: freshUrl }
        : suggestion.asset,
      source_json: {
        ...suggestion.source,
        schedulePublish: true,
      },
    })
    .eq("id", params.suggestionId)
    .eq("restaurant_id", params.restaurantId);

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

/** Cron: freigegebene, geplante Vorschläge zur Uhrzeit posten. */
export async function processDueApprovedSocialSuggestions(
  sb: SupabaseClient,
): Promise<{ due: number; published: number; failed: number }> {
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
    return { due: 0, published: 0, failed: 0 };
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
    });
    if (result.ok) published += 1;
    else failed += 1;
  }

  return { due, published, failed };
}
