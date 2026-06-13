import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { reviewExternalId } from "@/lib/reviews/review-settings-types";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewVisibilityKey = {
  platform: ReviewPlatform;
  externalId: string;
};

export function visibilityKeyFromReview(
  review: Pick<UnifiedReview, "id" | "platform">,
): ReviewVisibilityKey {
  return {
    platform: review.platform,
    externalId: reviewExternalId(review),
  };
}

export async function fetchHiddenReviewKeys(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("restaurant_review_visibility")
    .select("platform, external_id")
    .eq("restaurant_id", restaurantId);

  if (error) {
    console.warn("[gwada] review visibility read", error.message);
    return new Set();
  }

  return new Set(
    (data ?? []).map(
      (row) => `${row.platform as string}:${row.external_id as string}`,
    ),
  );
}

export function isReviewHiddenFromPublic(
  review: Pick<UnifiedReview, "id" | "platform">,
  hiddenKeys: Set<string>,
): boolean {
  const { platform, externalId } = visibilityKeyFromReview(review);
  return hiddenKeys.has(`${platform}:${externalId}`);
}

export async function setReviewHiddenFromPublic(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    platform: ReviewPlatform;
    reviewId: string;
    hidden: boolean;
    hiddenBy?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const externalId = reviewExternalId({
    id: params.reviewId,
    platform: params.platform,
  });

  if (params.hidden) {
    const { error } = await sb.from("restaurant_review_visibility").upsert(
      {
        restaurant_id: params.restaurantId,
        platform: params.platform,
        external_id: externalId,
        hidden_by: params.hiddenBy ?? null,
      },
      { onConflict: "restaurant_id,platform,external_id" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await sb
    .from("restaurant_review_visibility")
    .delete()
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", params.platform)
    .eq("external_id", externalId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function enrichReviewsWithVisibility(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    reviews: UnifiedReview[];
  },
): Promise<UnifiedReview[]> {
  if (params.reviews.length === 0) return params.reviews;

  const { data, error } = await sb
    .from("restaurant_review_visibility")
    .select("platform, external_id")
    .eq("restaurant_id", params.restaurantId);

  if (error) {
    console.warn("[gwada] review visibility enrich", error.message);
    return params.reviews;
  }

  const hiddenKeys = new Set(
    (data ?? []).map(
      (row) => `${row.platform as string}:${row.external_id as string}`,
    ),
  );

  return params.reviews.map((review) => ({
    ...review,
    hiddenFromPublic: isReviewHiddenFromPublic(review, hiddenKeys),
  }));
}

export function filterReviewsForPublicEmbed<T extends Pick<UnifiedReview, "id" | "platform">>(
  reviews: T[],
  hiddenKeys: Set<string>,
): T[] {
  return reviews.filter((review) => !isReviewHiddenFromPublic(review, hiddenKeys));
}
