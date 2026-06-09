import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { upsertReviewRead } from "@/lib/supabase/restaurant-review-reads-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function markReviewReadServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    platform: ReviewPlatform;
    reviewId: string;
  },
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  return upsertReviewRead(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    platform: params.platform,
    reviewId: params.reviewId,
    readAt: now,
    markedUnreadAt: null,
  });
}

export async function markReviewUnreadServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    platform: ReviewPlatform;
    reviewId: string;
  },
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  return upsertReviewRead(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    platform: params.platform,
    reviewId: params.reviewId,
    markedUnreadAt: now,
  });
}
