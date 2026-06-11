import "server-only";

import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import { enrichReviewsWithReadState } from "@/lib/reviews/enrich-reviews-with-read-state";
import { readPlatformSyncMeta, readReviewsFeedFromCache } from "@/lib/reviews/reviews-feed-read-server";
import { averageRating } from "@/lib/reviews/review-stats";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  isUnread: boolean;
};

export type DashboardReviewsSummary = {
  platforms: DashboardReviewPlatformStat[];
  recent: DashboardReviewRecentItem[];
  unreadRecentCount: number;
};

const PLATFORM_HREF: Record<ReviewPlatform, string> = {
  gwada: "/dashboard/bewertungen/uebersicht?platform=gwada",
  google: "/dashboard/bewertungen/uebersicht?platform=google",
  facebook: "/dashboard/bewertungen/uebersicht?platform=facebook",
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
    isUnread: review.isUnread ?? true,
  };
}

export async function loadDashboardReviewsSummary(
  restaurantId: string,
  userId: string,
  sb: SupabaseClient,
): Promise<DashboardReviewsSummary> {
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

  const [googleIntegration, facebookIntegration, cachedFeed] = await Promise.all([
    fetchRestaurantOAuthIntegrationAdmin(restaurantId, "google_business", (raw) =>
      oauthConfigFromJson(raw),
    ),
    fetchRestaurantOAuthIntegrationAdmin(restaurantId, "facebook", (raw) =>
      oauthConfigFromJson(raw),
    ),
    readReviewsFeedFromCache(restaurantId, sb, ["google", "facebook"]),
  ]);

  const googleIntegrationOk = googleIntegration?.status === "working";
  const facebookIntegrationOk = facebookIntegration?.status === "working";

  const googleMeta = readPlatformSyncMeta(cachedFeed.syncRows, "google");
  const googleCached = cachedFeed.reviews.filter((r) => r.platform === "google");
  const googleRecent = googleCached.slice(0, 8);

  const googleConnected =
    googleIntegrationOk &&
    (googleCached.length > 0 ||
      typeof googleMeta.totalReviewCount === "number" ||
      !cachedFeed.sync.platformErrors.google);

  const googleCount =
    typeof googleMeta.totalReviewCount === "number"
      ? googleMeta.totalReviewCount
      : googleCached.length;

  const googleAvg =
    typeof googleMeta.averageRating === "number"
      ? googleMeta.averageRating
      : averageRating(googleCached);

  const facebookCached = cachedFeed.reviews.filter((r) => r.platform === "facebook");
  const facebookConnected =
    facebookIntegrationOk &&
    (facebookCached.length > 0 || !cachedFeed.sync.platformErrors.facebook);

  const facebookRecent = facebookCached.slice(0, 8);
  const facebookCount = facebookCached.length;
  const facebookAvg = facebookConnected ? averageRating(facebookCached) : null;

  const mergedRecent = [...gwadaReviews, ...googleRecent, ...facebookRecent].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const enrichedRecent = await enrichReviewsWithReadState(sb, {
    restaurantId,
    userId,
    reviews: mergedRecent,
  });

  const unreadRecent = enrichedRecent
    .filter((r) => r.isUnread)
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

  return {
    platforms,
    recent: unreadRecent,
    unreadRecentCount: enrichedRecent.filter((r) => r.isUnread).length,
  };
}
