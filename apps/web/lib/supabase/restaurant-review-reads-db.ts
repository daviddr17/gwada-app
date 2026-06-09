import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  reviewReadLookupKey,
  type ReviewReadRow,
} from "@/lib/reviews/review-read-state";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const SELECT = `
  platform,
  review_id,
  read_at,
  marked_unread_at
`;

export async function fetchReviewReadsForUser(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    platform?: ReviewPlatform;
  },
): Promise<Map<string, ReviewReadRow>> {
  const map = new Map<string, ReviewReadRow>();
  if (!isUuidRestaurantId(params.restaurantId)) return map;

  let q = sb
    .from("restaurant_review_reads")
    .select(SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("user_id", params.userId);

  if (params.platform) {
    q = q.eq("platform", params.platform);
  }

  const { data, error } = await q;
  if (error) return map;

  for (const raw of data ?? []) {
    const row = raw as ReviewReadRow;
    map.set(reviewReadLookupKey(row.platform, row.review_id), row);
  }
  return map;
}

export async function upsertReviewRead(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    platform: ReviewPlatform;
    reviewId: string;
    readAt?: string | null;
    markedUnreadAt?: string | null;
  },
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {
    restaurant_id: params.restaurantId,
    user_id: params.userId,
    platform: params.platform,
    review_id: params.reviewId,
  };
  if (params.readAt !== undefined) {
    patch.read_at = params.readAt;
  }
  if (params.markedUnreadAt !== undefined) {
    patch.marked_unread_at = params.markedUnreadAt;
  }

  const { error } = await sb.from("restaurant_review_reads").upsert(patch, {
    onConflict: "restaurant_id,user_id,platform,review_id",
  });

  return { error: error?.message ?? null };
}

export async function upsertReviewReadsBatch(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    items: readonly { platform: ReviewPlatform; reviewId: string }[];
    readAt: string;
  },
): Promise<{ error: string | null; count: number }> {
  if (params.items.length === 0) {
    return { error: null, count: 0 };
  }

  const rows = params.items.map((item) => ({
    restaurant_id: params.restaurantId,
    user_id: params.userId,
    platform: item.platform,
    review_id: item.reviewId,
    read_at: params.readAt,
    marked_unread_at: null,
  }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from("restaurant_review_reads").upsert(chunk, {
      onConflict: "restaurant_id,user_id,platform,review_id",
    });
    if (error) {
      return { error: error.message, count: i };
    }
  }

  return { error: null, count: rows.length };
}
