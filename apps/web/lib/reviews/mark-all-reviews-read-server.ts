import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { readCachedReviews } from "@/lib/reviews/reviews-cache-db";
import { upsertReviewReadsBatch } from "@/lib/supabase/restaurant-review-reads-db";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Alle bekannten Bewertungen als gelesen (Glocke „Alle“ / Übersichtsbesuch).
 * Quelle: Cache (+ Gwada-DB) — nicht Live-APIs (Rate-Limits / unvollständige Seiten
 * ließen TripAdvisor & Cache-only Reviews ungelesen → Glocke füllte sich wieder).
 */
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

  const cached = await readCachedReviews(sb, params.restaurantId, [
    "google",
    "facebook",
    "tripadvisor",
  ]);
  for (const review of cached) {
    items.push({ platform: review.platform, reviewId: review.id });
  }

  return markReviewsReadBatchServer(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    items: dedupeReviewItems(items),
  });
}
