import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import {
  fetchRestaurantOAuthIntegrationAdmin,
} from "@/lib/supabase/restaurant-oauth-integration-db";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

type FacebookRatingRaw = {
  created_time?: string;
  rating?: number;
  review_text?: string;
  recommendation_type?: string;
  reviewer?: { name?: string };
  open_graph_story?: { id?: string };
};

/** Stabile ID ohne open_graph_story — Index würde bei API-Reihenfolge Push-Duplikate erzeugen. */
function stableFacebookReviewExternalId(
  pageId: string,
  raw: FacebookRatingRaw,
): string {
  const storyId = raw.open_graph_story?.id?.trim();
  if (storyId) return storyId;

  const key = [
    pageId,
    raw.created_time ?? "",
    raw.reviewer?.name ?? "",
    (raw.review_text ?? "").trim().slice(0, 120),
  ].join("|");
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `fb-${pageId}-${hash.toString(16)}`;
}

export async function fetchFacebookReviewsForRestaurant(
  restaurantId: string,
): Promise<{ reviews: UnifiedReview[] } | { error: string }> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") {
    return { error: "facebook_not_connected" };
  }

  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) return { error: "facebook_token_missing" };

  const fields = [
    "created_time",
    "rating",
    "review_text",
    "recommendation_type",
    "reviewer{name}",
    "open_graph_story{id}",
  ].join(",");

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/ratings?fields=${encodeURIComponent(fields)}&limit=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await res.json()) as {
    data?: FacebookRatingRaw[];
    error?: { message?: string };
  };

  if (!res.ok) {
    return { error: body.error?.message ?? `facebook_ratings_${res.status}` };
  }

  const reviews: UnifiedReview[] = (body.data ?? []).map((r) => {
    const positive = r.recommendation_type === "positive";
    const rating =
      typeof r.rating === "number" && r.rating > 0
        ? r.rating
        : positive
          ? 5
          : r.recommendation_type === "negative"
            ? 1
            : 0;
    return {
      id: stableFacebookReviewExternalId(pageId, r),
      platform: "facebook" as const,
      rating,
      comment: r.review_text?.trim() || null,
      authorName: r.reviewer?.name?.trim() || null,
      createdAt: r.created_time ?? new Date().toISOString(),
      reply: null,
      canReply: Boolean(r.open_graph_story?.id),
      externalUrl: null,
    };
  });

  return { reviews };
}

export async function replyToFacebookRecommendation(params: {
  restaurantId: string;
  storyId: string;
  message: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    params.restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") {
    return { error: "facebook_not_connected" };
  }

  const token = row.config.page_access_token?.trim();
  const storyId = params.storyId.trim();
  if (!token || !storyId) return { error: "invalid_request" };

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${storyId}/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      message: params.message.trim(),
      access_token: token,
    }),
    cache: "no-store",
  });
  const body = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || body.error) {
    return { error: body.error?.message ?? `facebook_reply_${res.status}` };
  }
  return { ok: true };
}
