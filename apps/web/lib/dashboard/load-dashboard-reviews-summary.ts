import "server-only";

import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import { enrichReviewsWithReadState } from "@/lib/reviews/enrich-reviews-with-read-state";
import { readPlatformSyncMeta, readReviewsFeedFromCache } from "@/lib/reviews/reviews-feed-read-server";
import {
  fetchReviewPlatformMessagingFlags,
  isReviewPlatformVisibleInDashboard,
} from "@/lib/reviews/reviews-platform-availability-server";
import { averageRating } from "@/lib/reviews/review-stats";
import { isReviewInNotificationWindow } from "@/lib/reviews/review-notification-window";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { formatReviewCommentDisplay } from "@/lib/reviews/format-review-comment";
import { dashboardReviewNotificationHref } from "@/lib/reviews/review-notification-href";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import { fetchRestaurantTripadvisorConfigAdmin } from "@/lib/supabase/restaurant-tripadvisor-integration-db";
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

const PLATFORM_OVERVIEW_HREF: Record<ReviewPlatform, string> = {
  gwada: `${APP_ROUTES.bewertungen.overview}?platform=gwada`,
  google: `${APP_ROUTES.bewertungen.overview}?platform=google`,
  facebook: `${APP_ROUTES.bewertungen.overview}?platform=facebook`,
  tripadvisor: `${APP_ROUTES.bewertungen.overview}?platform=tripadvisor`,
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
    href: dashboardReviewNotificationHref(review.platform, review.id),
    isUnread: review.isUnread ?? true,
    contactId: review.contactId ?? null,
  };
}

export async function loadDashboardReviewsSummary(
  restaurantId: string,
  userId: string,
  sb: SupabaseClient,
): Promise<DashboardReviewsSummary> {
  // Recent (voll) + Ratings-Sample (schlank) parallel — kein 500er Full-Row-Payload.
  const [
    gwadaRecentResult,
    gwadaCountResult,
    gwadaAvgResult,
    googleIntegration,
    facebookIntegration,
    tripadvisorIntegration,
    cachedFeed,
    platformFlags,
  ] = await Promise.all([
    sb
      .from("gwada_reviews")
      .select(
        "id, rating, comment, guest_display_name, created_at, reservation_id, invitation_id",
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(8),
    sb
      .from("gwada_reviews")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    sb
      .from("gwada_reviews")
      .select("avg(rating)")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    fetchRestaurantOAuthIntegrationAdmin(restaurantId, "google_business", (raw) =>
      oauthConfigFromJson(raw),
    ),
    fetchRestaurantOAuthIntegrationAdmin(restaurantId, "facebook", (raw) =>
      oauthConfigFromJson(raw),
    ),
    fetchRestaurantTripadvisorConfigAdmin(restaurantId),
    readReviewsFeedFromCache(restaurantId, sb, ["google", "facebook", "tripadvisor"], {
      recentPerPlatform: 8,
    }),
    fetchReviewPlatformMessagingFlags(sb),
  ]);

  const gwadaRecentRows = gwadaRecentResult.data ?? [];
  const gwadaCount = gwadaCountResult.count ?? 0;
  const gwadaAvgRaw = (gwadaAvgResult.data as { avg?: number | string | null } | null)
    ?.avg;
  const gwadaAvg =
    gwadaAvgRaw != null && String(gwadaAvgRaw).length > 0
      ? Number(gwadaAvgRaw)
      : null;

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
    contactId: null,
  }));


  const googleIntegrationOk = googleIntegration?.status === "working";
  const facebookIntegrationOk = facebookIntegration?.status === "working";
  const tripadvisorIntegrationOk = tripadvisorIntegration?.status === "working";

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

  const facebookMeta = readPlatformSyncMeta(cachedFeed.syncRows, "facebook");
  const facebookCached = cachedFeed.reviews.filter((r) => r.platform === "facebook");
  const facebookConnected =
    facebookIntegrationOk &&
    (facebookCached.length > 0 || !cachedFeed.sync.platformErrors.facebook);

  const facebookRecent = facebookCached.slice(0, 8);
  const facebookCount =
    typeof facebookMeta.totalReviewCount === "number"
      ? facebookMeta.totalReviewCount
      : facebookCached.length;
  const facebookAvg =
    typeof facebookMeta.averageRating === "number"
      ? facebookMeta.averageRating
      : facebookConnected
        ? averageRating(facebookCached)
        : null;

  const tripadvisorMeta = readPlatformSyncMeta(cachedFeed.syncRows, "tripadvisor");
  const tripadvisorCached = cachedFeed.reviews.filter(
    (r) => r.platform === "tripadvisor",
  );
  const tripadvisorConnected =
    tripadvisorIntegrationOk &&
    (tripadvisorCached.length > 0 ||
      typeof tripadvisorMeta.totalReviewCount === "number" ||
      !cachedFeed.sync.platformErrors.tripadvisor);
  const tripadvisorRecent = tripadvisorCached.slice(0, 8);
  const tripadvisorCount =
    typeof tripadvisorMeta.totalReviewCount === "number"
      ? tripadvisorMeta.totalReviewCount
      : tripadvisorCached.length;
  const tripadvisorAvg =
    typeof tripadvisorMeta.averageRating === "number"
      ? tripadvisorMeta.averageRating
      : averageRating(tripadvisorCached);

  const platformVisibility = {
    flags: platformFlags,
    googleConnected,
    facebookConnected,
    tripadvisorConnected,
  };

  const mergedRecent = [
    ...gwadaReviews,
    ...(isReviewPlatformVisibleInDashboard("google", platformVisibility)
      ? googleRecent
      : []),
    ...(isReviewPlatformVisibleInDashboard("facebook", platformVisibility)
      ? facebookRecent
      : []),
    ...(isReviewPlatformVisibleInDashboard("tripadvisor", platformVisibility)
      ? tripadvisorRecent
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

  // Nur Bewertungen im Push-/Glocken-Fenster — sonst füllt Cache-Historie
  // nach jedem Dismiss die nächsten alten Unreads nach.
  const notifiableUnread = visibleRecent.filter(
    (r) => r.isUnread && isReviewInNotificationWindow(r.createdAt),
  );

  const unreadRecent = notifiableUnread.slice(0, 5).map(toRecentItem);

  const allPlatforms: DashboardReviewPlatformStat[] = [
    {
      platform: "gwada",
      label: REVIEW_PLATFORM_LABELS.gwada,
      connected: true,
      count: gwadaCount,
      average: gwadaAvg,
      href: PLATFORM_OVERVIEW_HREF.gwada,
    },
    {
      platform: "google",
      label: REVIEW_PLATFORM_LABELS.google,
      connected: googleConnected,
      count: googleCount,
      average: googleAvg,
      href: PLATFORM_OVERVIEW_HREF.google,
    },
    {
      platform: "facebook",
      label: REVIEW_PLATFORM_LABELS.facebook,
      connected: facebookConnected,
      count: facebookCount,
      average: facebookAvg,
      href: PLATFORM_OVERVIEW_HREF.facebook,
    },
    {
      platform: "tripadvisor",
      label: REVIEW_PLATFORM_LABELS.tripadvisor,
      connected: tripadvisorConnected,
      count: tripadvisorCount,
      average: tripadvisorAvg,
      href: PLATFORM_OVERVIEW_HREF.tripadvisor,
    },
  ];

  const platforms = allPlatforms.filter((entry) =>
    isReviewPlatformVisibleInDashboard(entry.platform, platformVisibility),
  );

  return {
    platforms,
    recent: unreadRecent,
    unreadRecentCount: notifiableUnread.length,
  };
}
