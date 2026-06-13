import { after } from "next/server";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { REVIEW_PLATFORMS } from "@/lib/constants/review-platforms";
import { enrichGwadaReviewsWithContactIds } from "@/lib/reviews/contact-gwada-review-server";
import { enrichReviewsWithReadState } from "@/lib/reviews/enrich-reviews-with-read-state";
import { enrichReviewsWithVisibility } from "@/lib/reviews/review-visibility-server";
import { paginateCachedGoogleReviews } from "@/lib/reviews/reviews-cache-pagination";
import {
  readPlatformSyncMeta,
  readReviewsFeedFromCache,
} from "@/lib/reviews/reviews-feed-read-server";
import { triggerReviewsFeedSyncIfStale } from "@/lib/reviews/reviews-feed-sync-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import {
  averageRating,
  medianRating,
  ratingDistribution,
} from "@/lib/reviews/review-stats";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isReviewPlatform(v: string): v is ReviewPlatform {
  return (REVIEW_PLATFORMS as readonly string[]).includes(v);
}

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const platformRaw =
    new URL(req.url).searchParams.get("platform")?.trim() ?? "gwada";

  if (!isReviewPlatform(platformRaw)) {
    return Response.json({ error: "invalid_platform" }, { status: 400 });
  }

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  let reviews: UnifiedReview[] = [];
  let loadError: string | null = null;

  if (platformRaw === "gwada") {
    const { data, error } = await auth.sb
      .from("gwada_reviews")
      .select(
        "id, rating, comment, guest_display_name, created_at, reservation_id, invitation_id",
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const admin = createSupabaseAdminClient();
    const reservationIds = [
      ...new Set(
        rows
          .map((r) => r.reservation_id as string | null)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const reservationNumberById = new Map<string, number>();
    if (reservationIds.length > 0) {
      const { data: reservationRows } = await auth.sb
        .from("reservations")
        .select("id, reservation_number")
        .eq("restaurant_id", restaurantId)
        .in("id", reservationIds);
      for (const row of reservationRows ?? []) {
        reservationNumberById.set(
          row.id as string,
          Number(row.reservation_number),
        );
      }
    }
    const contactByReviewId =
      admin && rows.length > 0
        ? await enrichGwadaReviewsWithContactIds(
            admin,
            restaurantId,
            rows.map((r) => ({
              id: r.id as string,
              reservation_id: (r.reservation_id as string | null) ?? null,
              invitation_id: r.invitation_id as string,
            })),
          )
        : new Map<string, string>();

    reviews = rows.map((r) => {
      const reservationId = (r.reservation_id as string | null) ?? null;
      return {
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
        reservationId,
        reservationNumber: reservationId
          ? (reservationNumberById.get(reservationId) ?? null)
          : null,
      };
    });
    reviews = await enrichReviewsWithReadState(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews,
      platform: "gwada",
    });
    reviews = await enrichReviewsWithVisibility(auth.sb, { restaurantId, reviews });
  } else if (platformRaw === "google") {
    const pageToken =
      new URL(req.url).searchParams.get("googlePageToken")?.trim() || null;

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
    const { reviews: cachedFacebook, sync } = await readReviewsFeedFromCache(
      restaurantId,
      auth.sb,
      ["facebook"],
    );

    after(() => {
      void triggerReviewsFeedSyncIfStale(restaurantId, ["facebook"]);
    });

    loadError = sync.platformErrors.facebook ?? null;
    reviews = cachedFacebook;

    reviews = await enrichReviewsWithReadState(auth.sb, {
      restaurantId,
      userId: auth.userId,
      reviews,
      platform: "facebook",
    });
    reviews = await enrichReviewsWithVisibility(auth.sb, { restaurantId, reviews });
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
