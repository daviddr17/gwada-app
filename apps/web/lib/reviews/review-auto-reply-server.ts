import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { replyToFacebookRecommendation } from "@/lib/reviews/facebook-reviews-api";
import { replyToGoogleReview } from "@/lib/reviews/google-reviews-api";
import { loadGwadaReviewsForFeed } from "@/lib/reviews/reviews-gwada-feed-server";
import { readCachedReviews } from "@/lib/reviews/reviews-cache-db";
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

export async function logReviewAutoReply(
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

export async function updateCachedReviewReply(
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

async function replyToGwadaReview(
  admin: SupabaseClient,
  restaurantId: string,
  reviewId: string,
  comment: string,
): Promise<{ ok: true } | { error: string }> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("gwada_reviews")
    .update({
      owner_reply: comment,
      owner_reply_at: now,
    })
    .eq("id", reviewId)
    .eq("restaurant_id", restaurantId)
    .is("owner_reply", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: "already_replied" };
  }
  return { ok: true };
}

export async function tryAutoReplyToReview(
  restaurantId: string,
  review: UnifiedReview,
): Promise<boolean> {
  if (review.reply?.trim()) return false;
  if (!review.canReply) return false;

  const rating = Math.round(review.rating);
  if (rating < 1 || rating > 5) return false;

  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const externalId = reviewExternalId(review);
  if (await alreadyAutoReplied(admin, restaurantId, review.platform, externalId)) {
    return false;
  }

  const rules = await fetchReviewAutoReplyRules(admin, restaurantId);
  const rule = rules.find(
    (entry) =>
      entry.platform === review.platform &&
      entry.rating === rating &&
      entry.enabled &&
      entry.replyTemplate.trim().length > 0,
  );
  if (!rule) return false;

  const restaurantName = await fetchRestaurantName(admin, restaurantId);
  const comment = interpolateReviewAutoReplyTemplate(rule.replyTemplate, {
    authorName: review.authorName,
    rating,
    restaurantName,
  }).trim();
  if (!comment) return false;

  let sent = false;
  if (review.platform === "google") {
    const result = await replyToGoogleReview({
      restaurantId,
      reviewName: review.id,
      comment,
    });
    sent = !("error" in result);
    if (!sent) {
      console.warn("[gwada] review auto-reply google failed", {
        restaurantId,
        externalId,
        error: "error" in result ? result.error : "unknown",
      });
    }
  } else if (review.platform === "facebook") {
    const result = await replyToFacebookRecommendation({
      restaurantId,
      storyId: review.id,
      message: comment,
    });
    sent = !("error" in result);
    if (!sent) {
      console.warn("[gwada] review auto-reply facebook failed", {
        restaurantId,
        externalId,
        error: "error" in result ? result.error : "unknown",
      });
    }
  } else if (review.platform === "gwada") {
    const result = await replyToGwadaReview(admin, restaurantId, review.id, comment);
    sent = !("error" in result);
    if ("error" in result && result.error !== "already_replied") {
      console.warn("[gwada] review auto-reply gwada failed", {
        restaurantId,
        externalId,
        error: result.error,
      });
    }
  }

  if (!sent) return false;

  await logReviewAutoReply(admin, restaurantId, review.platform, externalId);

  if (review.platform === "google" || review.platform === "facebook") {
    await updateCachedReviewReply(
      admin,
      restaurantId,
      review.platform,
      externalId,
      comment,
    );
  }

  return true;
}

/** Alle offenen Bewertungen (nicht nur neu beim Sync) — Retry + Backfill. */
export async function tryAutoReplyToPendingReviews(
  restaurantId: string,
  reviews: UnifiedReview[],
  platform?: ReviewPlatform,
): Promise<{ attempted: number; sent: number }> {
  let attempted = 0;
  let sent = 0;

  for (const review of reviews) {
    if (platform && review.platform !== platform) continue;
    if (review.reply?.trim()) continue;
    attempted += 1;
    const ok = await tryAutoReplyToReview(restaurantId, review);
    if (ok) sent += 1;
  }

  return { attempted, sent };
}

/** Nach Speichern der Regeln oder manuell: alle Plattformen durchlaufen. */
export async function runReviewAutoReplyBackfill(
  restaurantId: string,
): Promise<{ attempted: number; sent: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { attempted: 0, sent: 0 };

  const [gwadaReviews, cachedReviews] = await Promise.all([
    loadGwadaReviewsForFeed(admin, restaurantId),
    readCachedReviews(admin, restaurantId),
  ]);

  return tryAutoReplyToPendingReviews(restaurantId, [
    ...gwadaReviews,
    ...cachedReviews,
  ]);
}

/** @deprecated Alias — bitte `tryAutoReplyToPendingReviews` nutzen. */
export async function tryAutoReplyToNewReviews(
  restaurantId: string,
  reviews: UnifiedReview[],
  _previousExternalIds: Set<string>,
  platform: ReviewPlatform,
): Promise<void> {
  await tryAutoReplyToPendingReviews(restaurantId, reviews, platform);
}
