import { after } from "next/server";
import { REVIEW_FILTER_ALL } from "@/lib/constants/review-platforms";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { REVIEW_PLATFORMS } from "@/lib/constants/review-platforms";
import { enrichReviewsWithReadState } from "@/lib/reviews/enrich-reviews-with-read-state";
import { enrichReviewsWithVisibility } from "@/lib/reviews/review-visibility-server";
import {
  readPlatformSyncMeta,
  readReviewsFeedFromCache,
} from "@/lib/reviews/reviews-feed-read-server";
import { loadGwadaReviewsForFeed } from "@/lib/reviews/reviews-gwada-feed-server";
import {
  parseReviewsFeedListQuery,
  paginateReviewsFeedList,
} from "@/lib/reviews/reviews-feed-list-query";
import { loadMergedReviewsFeedPage } from "@/lib/reviews/reviews-merged-feed-server";
import { triggerReviewsFeedSyncIfStale } from "@/lib/reviews/reviews-feed-sync-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import {
  averageRating,
  medianRating,
  ratingDistribution,
} from "@/lib/reviews/review-stats";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function isReviewPlatform(v: string): v is ReviewPlatform {
  return (REVIEW_PLATFORMS as readonly string[]).includes(v);
}

function platformSupportsReplyFilter(platform: ReviewPlatform | "all"): boolean {
  return platform === "all" || platform === "google" || platform === "facebook";
}

async function enrichPageReviews(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    reviews: UnifiedReview[];
    platform?: ReviewPlatform;
  },
): Promise<UnifiedReview[]> {
  let reviews = await enrichReviewsWithReadState(sb, params);
  reviews = await enrichReviewsWithVisibility(sb, {
    restaurantId: params.restaurantId,
    reviews,
  });
  return reviews;
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const restaurantId = searchParams.get("restaurantId")?.trim() ?? "";
  const platformRaw = searchParams.get("platform")?.trim() ?? "gwada";

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  if (platformRaw === REVIEW_FILTER_ALL) {
    const pageToken = searchParams.get("pageToken")?.trim() || null;
    const listQuery = parseReviewsFeedListQuery(searchParams, {
      showReplyFilter: platformSupportsReplyFilter("all"),
    });

    after(() => {
      void triggerReviewsFeedSyncIfStale(restaurantId, [
        "google",
        "facebook",
        "tripadvisor",
      ]);
    });

    const merged = await loadMergedReviewsFeedPage({
      restaurantId,
      sb: auth.sb,
      pageToken,
      listQuery,
      enrichBeforeFilter: (reviews) =>
        enrichReviewsWithReadState(auth.sb, {
          restaurantId,
          userId: auth.userId,
          reviews,
        }),
    });

    const reviews = await enrichPageReviews(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews: merged.reviews,
    });

    return Response.json({
      platform: REVIEW_FILTER_ALL,
      reviews,
      summary: {
        count: merged.listQueryApplied
          ? merged.pagination.totalReviewCount
          : reviews.length,
        average: averageRating(reviews),
        median: medianRating(reviews),
        distribution: ratingDistribution(reviews),
        scope: merged.listQueryApplied ? ("filtered" as const) : ("page" as const),
      },
      mergedPagination: merged.pagination,
      platformTotals: merged.pagination.platformTotals,
      sync: merged.sync,
      loadErrors: merged.loadErrors,
      listQueryApplied: merged.listQueryApplied,
    });
  }

  if (!isReviewPlatform(platformRaw)) {
    return Response.json({ error: "invalid_platform" }, { status: 400 });
  }

  let reviews: UnifiedReview[] = [];
  let loadError: string | null = null;

  if (platformRaw === "gwada") {
    try {
      reviews = await loadGwadaReviewsForFeed(auth.sb, restaurantId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Bewertungen konnten nicht geladen werden.";
      return Response.json({ error: message }, { status: 500 });
    }

    reviews = await enrichPageReviews(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews,
      platform: "gwada",
    });

    return Response.json({
      platform: platformRaw,
      reviews,
      summary: {
        count: reviews.length,
        average: averageRating(reviews),
        median: medianRating(reviews),
        distribution: ratingDistribution(reviews),
      },
      loadError,
    });
  }

  if (platformRaw === "google") {
    const pageToken = searchParams.get("googlePageToken")?.trim() || null;
    const listQuery = parseReviewsFeedListQuery(searchParams, {
      showReplyFilter: platformSupportsReplyFilter("google"),
    });

    const { reviews: cachedGoogle, syncRows, sync } =
      await readReviewsFeedFromCache(restaurantId, auth.sb, ["google"]);

    after(() => {
      void triggerReviewsFeedSyncIfStale(restaurantId, ["google"]);
    });

    loadError = sync.platformErrors.google ?? null;

    const googleMeta = readPlatformSyncMeta(syncRows, "google");
    let source = cachedGoogle;
    if (listQuery.readFilter !== "all") {
      source = await enrichReviewsWithReadState(auth.sb, {
        restaurantId,
        userId: auth.userId,
        reviews: source,
        platform: "google",
      });
    }

    const paginated = paginateReviewsFeedList(source, pageToken, listQuery, {
      unfilteredTotalReviewCount:
        googleMeta.totalReviewCount ?? cachedGoogle.length,
      averageRating:
        typeof googleMeta.averageRating === "number"
          ? googleMeta.averageRating
          : null,
    });

    reviews = await enrichPageReviews(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews: paginated.reviews,
      platform: "google",
    });

    return Response.json({
      platform: platformRaw,
      reviews,
      summary: {
        count: paginated.listQueryApplied
          ? paginated.pagination.totalReviewCount
          : reviews.length,
        average: averageRating(reviews),
        median: medianRating(reviews),
        distribution: ratingDistribution(reviews),
        scope: paginated.listQueryApplied
          ? ("filtered" as const)
          : ("page" as const),
      },
      googlePagination: paginated.pagination,
      sync,
      loadError,
      listQueryApplied: paginated.listQueryApplied,
    });
  }

  if (platformRaw === "facebook") {
    const pageToken = searchParams.get("pageToken")?.trim() || null;
    const listQuery = parseReviewsFeedListQuery(searchParams, {
      showReplyFilter: platformSupportsReplyFilter("facebook"),
    });

    const { reviews: cachedFacebook, syncRows, sync } =
      await readReviewsFeedFromCache(restaurantId, auth.sb, ["facebook"]);

    after(() => {
      void triggerReviewsFeedSyncIfStale(restaurantId, ["facebook"]);
    });

    loadError = sync.platformErrors.facebook ?? null;
    const facebookSync = syncRows.find((row) => row.platform === "facebook");
    const facebookMeta = readPlatformSyncMeta(syncRows, "facebook");
    const facebookTotal =
      typeof facebookMeta.totalReviewCount === "number"
        ? facebookMeta.totalReviewCount
        : typeof facebookSync?.item_count === "number" && facebookSync.item_count > 0
          ? facebookSync.item_count
          : cachedFacebook.length;

    let source = cachedFacebook;
    if (listQuery.readFilter !== "all") {
      source = await enrichReviewsWithReadState(auth.sb, {
        restaurantId,
        userId: auth.userId,
        reviews: source,
        platform: "facebook",
      });
    }

    const paginated = paginateReviewsFeedList(source, pageToken, listQuery, {
      unfilteredTotalReviewCount: facebookTotal,
    });

    reviews = await enrichPageReviews(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews: paginated.reviews,
      platform: "facebook",
    });

    return Response.json({
      platform: platformRaw,
      reviews,
      summary: {
        count: paginated.listQueryApplied
          ? paginated.pagination.totalReviewCount
          : reviews.length,
        average: averageRating(reviews),
        median: medianRating(reviews),
        distribution: ratingDistribution(reviews),
        scope: paginated.listQueryApplied
          ? ("filtered" as const)
          : ("page" as const),
      },
      facebookPagination: paginated.pagination,
      sync,
      loadError,
      listQueryApplied: paginated.listQueryApplied,
    });
  }

  if (platformRaw === "tripadvisor") {
    const pageToken = searchParams.get("pageToken")?.trim() || null;
    const listQuery = parseReviewsFeedListQuery(searchParams, {
      showReplyFilter: platformSupportsReplyFilter("tripadvisor"),
    });

    const { reviews: cachedTripadvisor, syncRows, sync } =
      await readReviewsFeedFromCache(restaurantId, auth.sb, ["tripadvisor"]);

    after(() => {
      void triggerReviewsFeedSyncIfStale(restaurantId, ["tripadvisor"]);
    });

    loadError = sync.platformErrors.tripadvisor ?? null;
    const tripadvisorSync = syncRows.find((row) => row.platform === "tripadvisor");
    const tripadvisorMeta = readPlatformSyncMeta(syncRows, "tripadvisor");
    const tripadvisorTotal =
      typeof tripadvisorMeta.totalReviewCount === "number"
        ? tripadvisorMeta.totalReviewCount
        : typeof tripadvisorSync?.item_count === "number" &&
            tripadvisorSync.item_count > 0
          ? tripadvisorSync.item_count
          : cachedTripadvisor.length;

    let source = cachedTripadvisor;
    if (listQuery.readFilter !== "all") {
      source = await enrichReviewsWithReadState(auth.sb, {
        restaurantId,
        userId: auth.userId,
        reviews: source,
        platform: "tripadvisor",
      });
    }

    const paginated = paginateReviewsFeedList(source, pageToken, listQuery, {
      unfilteredTotalReviewCount: tripadvisorTotal,
    });

    reviews = await enrichPageReviews(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews: paginated.reviews,
      platform: "tripadvisor",
    });

    return Response.json({
      platform: platformRaw,
      reviews,
      summary: {
        count: paginated.listQueryApplied
          ? paginated.pagination.totalReviewCount
          : reviews.length,
        average: averageRating(reviews),
        median: medianRating(reviews),
        distribution: ratingDistribution(reviews),
        scope: paginated.listQueryApplied
          ? ("filtered" as const)
          : ("page" as const),
      },
      tripadvisorPagination: paginated.pagination,
      sync,
      loadError,
      listQueryApplied: paginated.listQueryApplied,
    });
  }

  return Response.json({
    platform: platformRaw,
    reviews,
    summary: {
      count: reviews.length,
      average: averageRating(reviews),
      median: medianRating(reviews),
      distribution: ratingDistribution(reviews),
    },
    loadError,
  });
}
