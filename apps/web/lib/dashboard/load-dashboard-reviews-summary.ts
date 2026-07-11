import "server-only";

import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import { enrichGwadaReviewsWithContactIds } from "@/lib/reviews/contact-gwada-review-server";
import { enrichReviewsWithReadState } from "@/lib/reviews/enrich-reviews-with-read-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readPlatformSyncMeta, readReviewsFeedFromCache } from "@/lib/reviews/reviews-feed-read-server";
import {
  fetchReviewPlatformMessagingFlags,
  isReviewPlatformVisibleInDashboard,
} from "@/lib/reviews/reviews-platform-availability-server";
import { averageRating } from "@/lib/reviews/review-stats";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { formatReviewCommentDisplay } from "@/lib/reviews/format-review-comment";
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
  /** Gwada: verknüpfter Kontakt, falls ermittelbar */
  contactId?: string | null;
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
  const t = formatReviewCommentDisplay(comment);
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
    contactId: review.contactId ?? null,
  };
}

export async function loadDashboardReviewsSummary(
  restaurantId: string,
  userId: string,
  sb: SupabaseClient,
): Promise<DashboardReviewsSummary> {
  const { data: gwadaRows, count: gwadaCountRaw } = await sb
    .from("gwada_reviews")
    .select(
      "id, rating, comment, guest_display_name, created_at, reservation_id, invitation_id",
      { count: "exact" },
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(500);

  const gwadaAll = gwadaRows ?? [];
  const gwadaRecentRows = gwadaAll.slice(0, 8);

  const admin = createSupabaseAdminClient();
  const contactByReviewId =
    admin && gwadaRecentRows.length > 0
      ? await enrichGwadaReviewsWithContactIds(
          admin,
          restaurantId,
          gwadaRecentRows.map((r) => ({
            id: r.id as string,
            reservation_id: (r.reservation_id as string | null) ?? null,
            invitation_id: r.invitation_id as string,
          })),
        )
      : new Map<string, string>();

  const gwadaReviews: UnifiedReview[] = gwadaRecentRows.map((r) => ({
    id: r.id as string,
    platform: "gwada" as const,
    rating: Number(r.rating),
    comment: (r.comment as string | null) ?? null,
    authorName: (r.guest_display_name as string | null) ?? null,
    createdAt: r.created_at as string,
    reply: null,
    canReply: false,
    externalUrl: null,
    contactId: contactByReviewId.get(r.id as string) ?? null,
  }));

  const gwadaCount = gwadaCountRaw ?? gwadaAll.length;
  const gwadaAvg = averageRating(
    gwadaAll.map((r) => ({ rating: Number(r.rating) })),
  );

  const [googleIntegration, facebookIntegration, cachedFeed, platformFlags] =
    await Promise.all([
      fetchRestaurantOAuthIntegrationAdmin(restaurantId, "google_business", (raw) =>
        oauthConfigFromJson(raw),
      ),
      fetchRestaurantOAuthIntegrationAdmin(restaurantId, "facebook", (raw) =>
        oauthConfigFromJson(raw),
      ),
      readReviewsFeedFromCache(restaurantId, sb, ["google", "facebook"]),
      fetchReviewPlatformMessagingFlags(sb),
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

  const platformVisibility = {
    flags: platformFlags,
    googleConnected,
    facebookConnected,
  };

  const mergedRecent = [
    ...gwadaReviews,
    ...(isReviewPlatformVisibleInDashboard("google", platformVisibility)
      ? googleRecent
      : []),
    ...(isReviewPlatformVisibleInDashboard("facebook", platformVisibility)
      ? facebookRecent
      : []),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const enrichedRecent = await enrichReviewsWithReadState(sb, {
    restaurantId,
    userId,
    reviews: mergedRecent,
  });

  const visibleRecent = enrichedRecent.filter((review) =>
    isReviewPlatformVisibleInDashboard(review.platform, platformVisibility),
  );

  const unreadRecent = visibleRecent
    .filter((r) => r.isUnread)
    .slice(0, 5)
    .map(toRecentItem);

  const allPlatforms: DashboardReviewPlatformStat[] = [
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

  const platforms = allPlatforms.filter((entry) =>
    isReviewPlatformVisibleInDashboard(entry.platform, platformVisibility),
  );

  return {
    platforms,
    recent: unreadRecent,
    unreadRecentCount: visibleRecent.filter((r) => r.isUnread).length,
  };
}
