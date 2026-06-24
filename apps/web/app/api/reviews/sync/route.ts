import { NextResponse } from "next/server";
import {
  isReviewsCacheablePlatform,
  REVIEWS_CACHEABLE_PLATFORMS,
  type ReviewsCacheablePlatform,
} from "@/lib/reviews/reviews-cache-constants";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { readReviewsFeedFromCache } from "@/lib/reviews/reviews-feed-read-server";
import { syncRestaurantReviewsPlatforms } from "@/lib/reviews/reviews-feed-sync-server";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    platform?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const platformParam = body.platform?.trim();
  const platforms: ReviewsCacheablePlatform[] | undefined =
    platformParam && isReviewsCacheablePlatform(platformParam as ReviewPlatform)
      ? [platformParam as ReviewsCacheablePlatform]
      : undefined;

  await syncRestaurantReviewsPlatforms(admin, restaurantId, platforms);
  const { sync } = await readReviewsFeedFromCache(restaurantId, auth.sb, [
    ...REVIEWS_CACHEABLE_PLATFORMS,
  ]);

  return NextResponse.json({ sync });
}
