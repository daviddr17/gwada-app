import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { publishShareToChannels } from "@/lib/share/share-publish-server";
import type { ShareChannelKey } from "@/lib/constants/share-channels";
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

  const imageUrl = suggestion.asset.imageUrl?.trim() || null;
  const publishNow =
    params.publishNow === true ||
    new Date(suggestion.plannedAt).getTime() <= Date.now() + 30 * 60_000;

  if (publishNow) {
    if (!imageUrl) {
      return { ok: false, error: "image_required" };
    }
    const channels = platformsToShareChannels(suggestion.platforms);
    const result = await publishShareToChannels({
      restaurantId: params.restaurantId,
      sb: params.sb,
      title: suggestion.title,
      body: caption,
      imageUrls: [imageUrl],
      channels,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
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
    if (!anyOk) {
      return { ok: false, error: errors[0] ?? "publish_failed" };
    }
    const upd = await updateSocialSuggestionStatusInDb(params.sb, {
      restaurantId: params.restaurantId,
      suggestionId: params.suggestionId,
      status: "approved",
      caption,
    });
    if (!upd.ok) return { ok: false, error: upd.error };
    return {
      ok: true,
      published: true,
      errors: errors.length ? errors : undefined,
    };
  }

  const upd = await updateSocialSuggestionStatusInDb(params.sb, {
    restaurantId: params.restaurantId,
    suggestionId: params.suggestionId,
    status: "approved",
    caption,
  });
  if (!upd.ok) return { ok: false, error: upd.error };
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
