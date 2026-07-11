import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  isReviewsCacheablePlatform,
  type ReviewsCacheablePlatform,
} from "@/lib/reviews/reviews-cache-constants";
import { tryAutoReplyToPendingReviews } from "@/lib/reviews/review-auto-reply-server";
import { scheduleDeliverForNotificationReferences } from "@/lib/notifications/schedule-notification-deliver";
import { reviewExternalId } from "@/lib/reviews/review-settings-types";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewsPlatformSyncMeta = {
  averageRating?: number | null;
  totalReviewCount?: number;
};

export type ReviewsPlatformSyncRow = {
  platform: ReviewsCacheablePlatform;
  synced_at: string | null;
  last_error: string | null;
  item_count: number;
  meta: ReviewsPlatformSyncMeta;
};

export function externalIdFromReview(review: UnifiedReview): string {
  return reviewExternalId(review);
}

function parseCachedReview(raw: unknown): UnifiedReview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.rating !== "number" || typeof o.createdAt !== "string") return null;
  return raw as UnifiedReview;
}

export async function readReviewsPlatformSyncState(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: ReviewsCacheablePlatform[],
): Promise<ReviewsPlatformSyncRow[]> {
  let query = sb
    .from("restaurant_reviews_platform_sync")
    .select("platform, synced_at, last_error, item_count, meta")
    .eq("restaurant_id", restaurantId);

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] reviews sync state read", error.message);
    return [];
  }

  return (data ?? [])
    .filter(
      (row): row is ReviewsPlatformSyncRow =>
        typeof row.platform === "string" &&
        isReviewsCacheablePlatform(row.platform as ReviewPlatform),
    )
    .map((row) => ({
      platform: row.platform as ReviewsCacheablePlatform,
      synced_at: (row.synced_at as string | null) ?? null,
      last_error: (row.last_error as string | null) ?? null,
      item_count: Number(row.item_count ?? 0),
      meta:
        row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
          ? (row.meta as ReviewsPlatformSyncMeta)
          : {},
    }));
}

export async function readCachedReviews(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: ReviewsCacheablePlatform[],
): Promise<UnifiedReview[]> {
  let query = sb
    .from("restaurant_reviews_platform_cache")
    .select("item, created_at, is_pinned")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] reviews cache read", error.message);
    return [];
  }

  const reviews: UnifiedReview[] = [];
  for (const row of data ?? []) {
    const review = parseCachedReview(row.item);
    if (!review) continue;
    const rowCreatedAt = row.created_at as string | null | undefined;
    if (rowCreatedAt && !review.createdAt) {
      review.createdAt = rowCreatedAt;
    }
    review.isPinned = Boolean(row.is_pinned);
    reviews.push(review);
  }
  return reviews;
}

export async function upsertReviewsPlatformCache(
  admin: SupabaseClient,
  restaurantId: string,
  platform: ReviewsCacheablePlatform,
  reviews: UnifiedReview[],
  syncedAt: string,
  lastError: string | null,
  meta: ReviewsPlatformSyncMeta = {},
): Promise<void> {
  const seenExternalIds = new Set<string>();
  const now = syncedAt;

  const { data: existingRows } = await admin
    .from("restaurant_reviews_platform_cache")
    .select("external_id")
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform);
  const previousExternalIds = new Set(
    (existingRows ?? []).map((row) => row.external_id as string),
  );

  if (reviews.length > 0) {
    const rows = reviews.map((review) => {
      const externalId = externalIdFromReview(review);
      seenExternalIds.add(externalId);
      return {
        restaurant_id: restaurantId,
        platform,
        external_id: externalId,
        item: review,
        created_at: review.createdAt,
        fetched_at: now,
      };
    });

    const { error: upsertError } = await admin
      .from("restaurant_reviews_platform_cache")
      .upsert(rows, { onConflict: "restaurant_id,platform,external_id" });

    if (upsertError) {
      console.warn("[gwada] reviews cache upsert", platform, upsertError.message);
    } else {
      void tryAutoReplyToPendingReviews(restaurantId, reviews, platform);

      const newReferenceIds = [...seenExternalIds]
        .filter((id) => !previousExternalIds.has(id))
        .map((id) => `${platform}:${id}`);
      if (newReferenceIds.length > 0) {
        void scheduleDeliverForNotificationReferences(admin, {
          restaurantId,
          module: "reviews",
          referenceIds: newReferenceIds,
        });
      }
    }
  }

  const { data: existing } = await admin
    .from("restaurant_reviews_platform_cache")
    .select("external_id")
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform);

  const staleIds = (existing ?? [])
    .map((row) => row.external_id as string)
    .filter((id) => !seenExternalIds.has(id));

  if (staleIds.length > 0) {
    await admin
      .from("restaurant_reviews_platform_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform)
      .in("external_id", staleIds);
  }

  if (reviews.length === 0) {
    await admin
      .from("restaurant_reviews_platform_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform);
  }

  await admin.from("restaurant_reviews_platform_sync").upsert(
    {
      restaurant_id: restaurantId,
      platform,
      synced_at: now,
      last_error: lastError,
      item_count: reviews.length,
      meta,
    },
    { onConflict: "restaurant_id,platform" },
  );
}
