import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { REVIEW_PLATFORMS } from "@/lib/constants/review-platforms";
import { fetchFacebookReviewsForRestaurant } from "@/lib/reviews/facebook-reviews-api";
import { fetchGoogleReviewsForRestaurant } from "@/lib/reviews/google-reviews-api";
import {
  averageRating,
  medianRating,
  ratingDistribution,
} from "@/lib/reviews/review-stats";
import { enrichGwadaReviewsWithContactIds } from "@/lib/reviews/contact-gwada-review-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
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

    reviews = rows.map((r) => ({
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
  } else if (platformRaw === "google") {
    const pageToken =
      new URL(req.url).searchParams.get("googlePageToken")?.trim() || null;
    const result = await fetchGoogleReviewsForRestaurant(restaurantId, {
      pageToken,
    });
    if ("error" in result) {
      loadError = result.error;
    } else {
      reviews = result.reviews;
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
        googlePagination: result.pagination,
        loadError,
      });
    }
  } else if (platformRaw === "facebook") {
    const result = await fetchFacebookReviewsForRestaurant(restaurantId);
    if ("error" in result) {
      loadError = result.error;
    } else {
      reviews = result.reviews;
    }
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
