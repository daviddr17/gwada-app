import { NextResponse } from "next/server";
import { isReviewPlatform } from "@/lib/constants/review-platforms";
import { revalidatePublicReviewsEmbedForRestaurant } from "@/lib/reviews/revalidate-public-reviews-embed";
import { setReviewHiddenFromPublic } from "@/lib/reviews/review-visibility-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    platform?: string;
    reviewId?: string;
    hidden?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const platformRaw = body.platform?.trim() ?? "";
  const reviewId = body.reviewId?.trim() ?? "";
  const hidden = Boolean(body.hidden);

  if (!reviewId || !isReviewPlatform(platformRaw)) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const result = await setReviewHiddenFromPublic(auth.sb, {
    restaurantId,
    platform: platformRaw,
    reviewId,
    hidden,
    hiddenBy: auth.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await revalidatePublicReviewsEmbedForRestaurant(auth.sb, restaurantId);

  return NextResponse.json({ ok: true, hiddenFromPublic: hidden });
}
