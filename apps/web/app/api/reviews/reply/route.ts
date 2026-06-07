import { replyToFacebookRecommendation } from "@/lib/reviews/facebook-reviews-api";
import { replyToGoogleReview } from "@/lib/reviews/google-reviews-api";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    platform?: string;
    reviewId?: string;
    comment?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const platform = body.platform?.trim();
  const reviewId = body.reviewId?.trim();
  const comment = body.comment?.trim();

  if (!reviewId || !comment) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  if (platform === "google") {
    const result = await replyToGoogleReview({
      restaurantId,
      reviewName: reviewId,
      comment,
    });
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 502 });
    }
    return Response.json({ ok: true });
  }

  if (platform === "facebook") {
    const result = await replyToFacebookRecommendation({
      restaurantId,
      storyId: reviewId,
      message: comment,
    });
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 502 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unsupported_platform" }, { status: 400 });
}
