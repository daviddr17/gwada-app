import {
  REVIEW_PLATFORMS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { markReviewsReadBatchServer } from "@/lib/reviews/mark-all-reviews-read-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    items?: { platform?: string; reviewId?: string }[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const items = (body.items ?? [])
    .map((item) => ({
      platform: item.platform?.trim() ?? "",
      reviewId: item.reviewId?.trim() ?? "",
    }))
    .filter(
      (item): item is { platform: ReviewPlatform; reviewId: string } =>
        Boolean(item.reviewId) &&
        (REVIEW_PLATFORMS as readonly string[]).includes(item.platform),
    );

  const result = await markReviewsReadBatchServer(auth.sb, {
    restaurantId,
    userId: auth.userId,
    items,
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json({ ok: true, count: result.count });
}
