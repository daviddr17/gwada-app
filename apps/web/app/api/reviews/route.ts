import { after } from "next/server";
import { REVIEW_FILTER_ALL } from "@/lib/constants/review-platforms";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { REVIEW_PLATFORMS } from "@/lib/constants/review-platforms";
import { enrichReviewsWithReadState } from "@/lib/reviews/enrich-reviews-with-read-state";
import { enrichReviewsWithVisibility } from "@/lib/reviews/review-visibility-server";
import { paginateCachedGoogleReviews } from "@/lib/reviews/reviews-cache-pagination";
import {
  readPlatformSyncMeta,
  readReviewsFeedFromCache,
} from "@/lib/reviews/reviews-feed-read-server";
import { loadGwadaReviewsForFeed } from "@/lib/reviews/reviews-gwada-feed-server";
import { paginateReviewList } from "@/lib/reviews/reviews-list-pagination";
import { loadMergedReviewsFeedPage } from "@/lib/reviews/reviews-merged-feed-server";
import { triggerReviewsFeedSyncIfStale } from "@/lib/reviews/reviews-feed-sync-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import {
  averageRating,
  medianRating,
  ratingDistribution,
} from "@/lib/reviews/review-stats";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

export const dynamic = "force-dynamic";

function isReviewPlatform(v: string): v is ReviewPlatform {
  return (REVIEW_PLATFORMS as readonly string[]).includes(v);
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

    after(() => {
      void triggerReviewsFeedSyncIfStale(restaurantId, ["google", "facebook"]);
    });

    const merged = await loadMergedReviewsFeedPage({
      restaurantId,
      sb: auth.sb,
      pageToken,
    });

    let reviews = await enrichReviewsWithReadState(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews: merged.reviews,
    });
    reviews = await enrichReviewsWithVisibility(auth.sb, { restaurantId, reviews });

    return Response.json({
      platform: REVIEW_FILTER_ALL,
      reviews,
      summary: {
        count: reviews.length,
        average: averageRating(reviews),
        median: medianRating(reviews),
        distribution: ratingDistribution(reviews),
        scope: "page" as const,
      },
      mergedPagination: merged.pagination,
      platformTotals: merged.pagination.platformTotals,
      sync: merged.sync,
      loadErrors: merged.loadErrors,
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

    reviews = await enrichReviewsWithReadState(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews,
      platform: "gwada",
    });
    reviews = await enrichReviewsWithVisibility(auth.sb, { restaurantId, reviews });
  } else if (platformRaw === "google") {
    const pageToken = searchParams.get("googlePageToken")?.trim() || null;

    const { reviews: cachedGoogle, syncRows, sync } =
      await readReviewsFeedFromCache(restaurantId, auth.sb, ["google"]);

    after(() => {
      void triggerReviewsFeedSyncIfStale(restaurantId, ["google"]);
    });

    loadError = sync.platformErrors.google ?? null;

    const googleMeta = readPlatformSyncMeta(syncRows, "google");
    const paginated = paginateCachedGoogleReviews(
      cachedGoogle,
      pageToken,
      googleMeta,
    );

    reviews = await enrichReviewsWithReadState(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews: paginated.reviews,
      platform: "google",
    });
    reviews = await enrichReviewsWithVisibility(auth.sb, { restaurantId, reviews });

    return Response.json({
      platform: platformRaw,
      reviews,
      summary: {
        count: reviews.length,
        average: averageRating(reviews),
        median: medianRating(reviews),
        distribution: ratingDistribution(reviews),
        scope: "page" as const,
      },
      googlePagination: paginated.pagination,
      sync,
      loadError,
    });
  } else if (platformRaw === "facebook") {
    const pageToken = searchParams.get("pageToken")?.trim() || null;

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

    const paginated = paginateReviewList(
      cachedFacebook,
      pageToken,
      facebookTotal,
    );

    reviews = await enrichReviewsWithReadState(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews: paginated.reviews,
      platform: "facebook",
    });
    reviews = await enrichReviewsWithVisibility(auth.sb, { restaurantId, reviews });

    return Response.json({
      platform: platformRaw,
      reviews,
      summary: {
        count: reviews.length,
        average: averageRating(reviews),
        median: medianRating(reviews),
        distribution: ratingDistribution(reviews),
        scope: "page" as const,
      },
      facebookPagination: paginated.pagination,
      sync,
      loadError,
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
