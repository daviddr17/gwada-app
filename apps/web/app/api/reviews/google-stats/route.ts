import { fetchGoogleReviewsLocationStats } from "@/lib/reviews/google-reviews-api";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";

export const dynamic = "force-dynamic";

/** Google-Durchschnitt und Gesamtanzahl (reviews.list mit pageSize=1). */
export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const result = await fetchGoogleReviewsLocationStats(restaurantId);
  if ("error" in result) {
    return Response.json(
      { error: result.error, loadError: result.error },
      { status: 502 },
    );
  }

  return Response.json({
    averageRating: result.averageRating,
    totalReviewCount: result.totalReviewCount,
  });
}
