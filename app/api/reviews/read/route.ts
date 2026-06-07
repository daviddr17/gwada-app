import {
  REVIEW_PLATFORMS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { markReviewReadServer } from "@/lib/reviews/mark-review-read-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    platform?: string;
    reviewId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const platformRaw = body.platform?.trim() ?? "";
  const reviewId = body.reviewId?.trim() ?? "";

  if (
    !restaurantId ||
    !reviewId ||
    !(REVIEW_PLATFORMS as readonly string[]).includes(platformRaw)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const result = await markReviewReadServer(auth.sb, {
    restaurantId,
    userId: auth.userId,
    platform: platformRaw as ReviewPlatform,
    reviewId,
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true });
}
