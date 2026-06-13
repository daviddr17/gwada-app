import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { replyToFacebookRecommendation } from "@/lib/reviews/facebook-reviews-api";
import { replyToGoogleReview } from "@/lib/reviews/google-reviews-api";
import { fetchReviewAutoReplyRules } from "@/lib/reviews/review-settings-db";
import {
  interpolateReviewAutoReplyTemplate,
  reviewExternalId,
} from "@/lib/reviews/review-settings-types";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

async function fetchRestaurantName(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string> {
  const { data } = await admin
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();
  return (data?.name as string | undefined)?.trim() || "Restaurant";
}

async function alreadyAutoReplied(
  admin: SupabaseClient,
  restaurantId: string,
  platform: ReviewPlatform,
  externalId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("restaurant_review_auto_reply_log")
    .select("external_id")
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform)
    .eq("external_id", externalId)
    .maybeSingle();
  return Boolean(data);
}

async function logAutoReply(
  admin: SupabaseClient,
  restaurantId: string,
  platform: ReviewPlatform,
  externalId: string,
): Promise<void> {
  await admin.from("restaurant_review_auto_reply_log").upsert(
    {
      restaurant_id: restaurantId,
      platform,
      external_id: externalId,
    },
    { onConflict: "restaurant_id,platform,external_id" },
  );
}

async function updateCachedReviewReply(
  admin: SupabaseClient,
  restaurantId: string,
  platform: ReviewPlatform,
  externalId: string,
  reply: string,
): Promise<void> {
  const { data } = await admin
    .from("restaurant_reviews_platform_cache")
    .select("item")
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform)
    .eq("external_id", externalId)
    .maybeSingle();

  if (!data?.item || typeof data.item !== "object" || Array.isArray(data.item)) {
    return;
  }

  const item = { ...(data.item as Record<string, unknown>), reply };
  await admin
    .from("restaurant_reviews_platform_cache")
    .update({ item })
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform)
    .eq("external_id", externalId);
}

export async function tryAutoReplyToReview(
  restaurantId: string,
  review: UnifiedReview,
): Promise<void> {
  if (review.platform === "gwada") return;
  if (review.reply?.trim()) return;
  if (!review.canReply) return;

  const rating = Math.round(review.rating);
  if (rating < 1 || rating > 5) return;

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const externalId = reviewExternalId(review);
  if (await alreadyAutoReplied(admin, restaurantId, review.platform, externalId)) {
    return;
  }

  const rules = await fetchReviewAutoReplyRules(admin, restaurantId);
  const rule = rules.find(
    (entry) =>
      entry.platform === review.platform &&
      entry.rating === rating &&
      entry.enabled &&
      entry.replyTemplate.trim().length > 0,
  );
  if (!rule) return;

  const restaurantName = await fetchRestaurantName(admin, restaurantId);
  const comment = interpolateReviewAutoReplyTemplate(rule.replyTemplate, {
    authorName: review.authorName,
    rating,
    restaurantName,
  }).trim();
  if (!comment) return;

  let sent = false;
  if (review.platform === "google") {
    const result = await replyToGoogleReview({
      restaurantId,
      reviewName: review.id,
      comment,
    });
    sent = !("error" in result);
  } else if (review.platform === "facebook") {
    const result = await replyToFacebookRecommendation({
      restaurantId,
      storyId: review.id,
      message: comment,
    });
    sent = !("error" in result);
  }

  if (!sent) return;

  await logAutoReply(admin, restaurantId, review.platform, externalId);
  await updateCachedReviewReply(
    admin,
    restaurantId,
    review.platform,
    externalId,
    comment,
  );
}

export async function tryAutoReplyToNewReviews(
  restaurantId: string,
  reviews: UnifiedReview[],
  previousExternalIds: Set<string>,
  platform: ReviewPlatform,
): Promise<void> {
  for (const review of reviews) {
    if (review.platform !== platform) continue;
    const externalId = reviewExternalId(review);
    if (previousExternalIds.has(externalId)) continue;
    await tryAutoReplyToReview(restaurantId, review);
  }
}
