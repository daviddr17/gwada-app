import { replyToFacebookRecommendation } from "@/lib/reviews/facebook-reviews-api";
import { replyToGoogleReview } from "@/lib/reviews/google-reviews-api";
import {
  updateCachedReviewReply,
} from "@/lib/reviews/review-auto-reply-server";
import { reviewExternalId } from "@/lib/reviews/review-settings-types";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const auth = await authorizeReviewsRestaurant(restaurantId, "update");
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();

  if (platform === "google") {
    const result = await replyToGoogleReview({
      restaurantId,
      reviewName: reviewId,
      comment,
    });
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 502 });
    }
    if (admin) {
      await updateCachedReviewReply(
        admin,
        restaurantId,
        "google",
        reviewExternalId({ id: reviewId, platform: "google" }),
        comment,
      );
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
    if (admin) {
      await updateCachedReviewReply(
        admin,
        restaurantId,
        "facebook",
        reviewExternalId({ id: reviewId, platform: "facebook" }),
        comment,
      );
    }
    return Response.json({ ok: true });
  }

  if (platform === "gwada") {
    if (!admin) {
      return Response.json({ error: "server_misconfigured" }, { status: 503 });
    }
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
      return Response.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return Response.json({ error: "already_replied" }, { status: 409 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unsupported_platform" }, { status: 400 });
}
