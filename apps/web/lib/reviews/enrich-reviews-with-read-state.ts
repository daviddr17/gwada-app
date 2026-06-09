import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  computeReviewUnread,
  reviewReadLookupKey,
} from "@/lib/reviews/review-read-state";
import { fetchReviewReadsForUser } from "@/lib/supabase/restaurant-review-reads-db";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function enrichReviewsWithReadState(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    reviews: UnifiedReview[];
    platform?: ReviewPlatform;
  },
): Promise<UnifiedReview[]> {
  if (params.reviews.length === 0) return params.reviews;

  const reads = await fetchReviewReadsForUser(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    platform: params.platform,
  });

  return params.reviews.map((review) => {
    const row = reads.get(reviewReadLookupKey(review.platform, review.id));
    return {
      ...review,
      isUnread: computeReviewUnread(row),
    };
  });
}
