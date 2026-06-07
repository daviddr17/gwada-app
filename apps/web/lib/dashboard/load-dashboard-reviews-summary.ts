import "server-only";

import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { fetchFacebookReviewsForRestaurant } from "@/lib/reviews/facebook-reviews-api";
import {
  fetchGoogleReviewsForRestaurant,
  fetchGoogleReviewsLocationStats,
} from "@/lib/reviews/google-reviews-api";
import { averageRating } from "@/lib/reviews/review-stats";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

export type DashboardReviewPlatformStat = {
  platform: ReviewPlatform;
  label: string;
  connected: boolean;
  count: number;
  average: number | null;
  href: string;
};

export type DashboardReviewRecentItem = {
  id: string;
  platform: ReviewPlatform;
  rating: number;
  authorName: string | null;
  commentPreview: string | null;
  createdAt: string;
  href: string;
};

export type DashboardReviewsSummary = {
  platforms: DashboardReviewPlatformStat[];
  recent: DashboardReviewRecentItem[];
};

const PLATFORM_HREF: Record<ReviewPlatform, string> = {
  gwada: "/bewertungen/uebersicht?platform=gwada",
  google: "/bewertungen/uebersicht?platform=google",
  facebook: "/bewertungen/uebersicht?platform=facebook",
};

function commentPreview(comment: string | null, max = 72): string | null {
  const t = comment?.trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function toRecentItem(review: UnifiedReview): DashboardReviewRecentItem {
  return {
    id: review.id,
    platform: review.platform,
    rating: review.rating,
    authorName: review.authorName,
    commentPreview: commentPreview(review.comment),
    createdAt: review.createdAt,
    href: PLATFORM_HREF[review.platform],
  };
}

export async function loadDashboardReviewsSummary(
  restaurantId: string,
): Promise<DashboardReviewsSummary> {
  const sb = await createSupabaseServerClient();

  const { count: gwadaCountRaw } = await sb
    .from("gwada_reviews")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  const { data: gwadaRows } = await sb
    .from("gwada_reviews")
    .select("id, rating, comment, guest_display_name, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(8);

  const gwadaReviews: UnifiedReview[] = (gwadaRows ?? []).map((r) => ({
    id: r.id as string,
    platform: "gwada" as const,
    rating: Number(r.rating),
    comment: (r.comment as string | null) ?? null,
    authorName: (r.guest_display_name as string | null) ?? null,
    createdAt: r.created_at as string,
    reply: null,
    canReply: false,
    externalUrl: null,
  }));

  const gwadaCount = gwadaCountRaw ?? 0;

  const { data: gwadaRatingRows } = await sb
    .from("gwada_reviews")
    .select("rating")
    .eq("restaurant_id", restaurantId)
    .limit(500);

  const gwadaAvg = averageRating(
    (gwadaRatingRows ?? []).map((r) => ({ rating: Number(r.rating) })),
  );

  const [googleStats, googleIntegration, facebookIntegration] = await Promise.all([
    fetchGoogleReviewsLocationStats(restaurantId),
    fetchRestaurantOAuthIntegrationAdmin(restaurantId, "google_business", (raw) =>
      oauthConfigFromJson(raw),
    ),
    fetchRestaurantOAuthIntegrationAdmin(restaurantId, "facebook", (raw) =>
      oauthConfigFromJson(raw),
    ),
  ]);

  const googleIntegrationOk = googleIntegration?.status === "working";
  const googleStatsOk = googleIntegrationOk && !("error" in googleStats);

  const googlePageResult = googleIntegrationOk
    ? await fetchGoogleReviewsForRestaurant(restaurantId, {
        pageToken: null,
        pageSize: 8,
      })
    : null;

  const googleRecent =
    googlePageResult && !("error" in googlePageResult)
      ? googlePageResult.reviews
      : [];

  const googleConnected =
    googleIntegrationOk && (googleStatsOk || googleRecent.length > 0);

  const googleCount = googleStatsOk
    ? googleStats.totalReviewCount
    : googlePageResult && !("error" in googlePageResult)
      ? googlePageResult.pagination.totalReviewCount
      : 0;

  const googleAvg =
    googleStatsOk && googleStats.averageRating != null
      ? googleStats.averageRating
      : googlePageResult && !("error" in googlePageResult)
        ? googlePageResult.pagination.averageRating
        : null;

  const fbResult =
    facebookIntegration?.status === "working"
      ? await fetchFacebookReviewsForRestaurant(restaurantId)
      : null;

  const facebookConnected =
    facebookIntegration?.status === "working" &&
    fbResult != null &&
    !("error" in fbResult);

  const facebookRecent = facebookConnected ? fbResult.reviews.slice(0, 8) : [];
  const facebookCount = facebookConnected ? fbResult.reviews.length : 0;
  const facebookAvg = facebookConnected
    ? averageRating(fbResult.reviews)
    : null;

  const mergedRecent = [...gwadaReviews, ...googleRecent, ...facebookRecent]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5)
    .map(toRecentItem);

  const platforms: DashboardReviewPlatformStat[] = [
    {
      platform: "gwada",
      label: REVIEW_PLATFORM_LABELS.gwada,
      connected: true,
      count: gwadaCount,
      average: gwadaAvg,
      href: PLATFORM_HREF.gwada,
    },
    {
      platform: "google",
      label: REVIEW_PLATFORM_LABELS.google,
      connected: googleConnected,
      count: googleCount,
      average: googleAvg,
      href: PLATFORM_HREF.google,
    },
    {
      platform: "facebook",
      label: REVIEW_PLATFORM_LABELS.facebook,
      connected: facebookConnected,
      count: facebookCount,
      average: facebookAvg,
      href: PLATFORM_HREF.facebook,
    },
  ];

  return { platforms, recent: mergedRecent };
}
