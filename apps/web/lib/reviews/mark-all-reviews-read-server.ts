import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { fetchFacebookReviewsForRestaurant } from "@/lib/reviews/facebook-reviews-api";
import { fetchGoogleReviewsForRestaurant } from "@/lib/reviews/google-reviews-api";
import { upsertReviewReadsBatch } from "@/lib/supabase/restaurant-review-reads-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const GOOGLE_READ_ALL_MAX_PAGES = 20;

function dedupeReviewItems(
  items: readonly { platform: ReviewPlatform; reviewId: string }[],
): { platform: ReviewPlatform; reviewId: string }[] {
  const seen = new Set<string>();
  const out: { platform: ReviewPlatform; reviewId: string }[] = [];
  for (const item of items) {
    const key = `${item.platform}:${item.reviewId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function markReviewsReadBatchServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    items: readonly { platform: ReviewPlatform; reviewId: string }[];
  },
): Promise<{ error: string | null; count: number }> {
  const items = dedupeReviewItems(params.items);
  if (items.length === 0) {
    return { error: null, count: 0 };
  }
  return upsertReviewReadsBatch(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    items,
    readAt: new Date().toISOString(),
  });
}

/** Beim Besuch der Bewertungs-Übersicht: alle bekannten Bewertungen als gelesen. */
export async function markAllReviewsReadForUserServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
  },
): Promise<{ error: string | null; count: number }> {
  const items: { platform: ReviewPlatform; reviewId: string }[] = [];

  const { data: gwadaRows, error: gwadaError } = await sb
    .from("gwada_reviews")
    .select("id")
    .eq("restaurant_id", params.restaurantId);

  if (gwadaError) {
    return { error: gwadaError.message, count: 0 };
  }

  for (const row of gwadaRows ?? []) {
    items.push({ platform: "gwada", reviewId: row.id as string });
  }

  const fbResult = await fetchFacebookReviewsForRestaurant(params.restaurantId);
  if (!("error" in fbResult)) {
    for (const review of fbResult.reviews) {
      items.push({ platform: "facebook", reviewId: review.id });
    }
  }

  let googlePageToken: string | null = null;
  for (let page = 0; page < GOOGLE_READ_ALL_MAX_PAGES; page += 1) {
    const googleResult = await fetchGoogleReviewsForRestaurant(
      params.restaurantId,
      { pageToken: googlePageToken, pageSize: 50 },
    );
    if ("error" in googleResult) break;
    for (const review of googleResult.reviews) {
      items.push({ platform: "google", reviewId: review.id });
    }
    googlePageToken = googleResult.pagination.nextPageToken;
    if (!googlePageToken) break;
  }

  return markReviewsReadBatchServer(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    items: dedupeReviewItems(items),
  });
}
