import { after } from "next/server";
import {
  readPlatformSyncMeta,
  readReviewsFeedFromCache,
} from "@/lib/reviews/reviews-feed-read-server";
import { triggerReviewsFeedSyncIfStale } from "@/lib/reviews/reviews-feed-sync-server";
import { fetchGoogleReviewsLocationStats } from "@/lib/reviews/google-reviews-api";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";

export const dynamic = "force-dynamic";

/** Google-Durchschnitt und Gesamtanzahl — primär aus Cache-Meta, Fallback Live-API. */
export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const { syncRows, sync } = await readReviewsFeedFromCache(
    restaurantId,
    auth.sb,
    ["google"],
  );

  after(() => {
    void triggerReviewsFeedSyncIfStale(restaurantId, ["google"]);
  });

  const meta = readPlatformSyncMeta(syncRows, "google");
  if (
    typeof meta.totalReviewCount === "number" ||
    typeof meta.averageRating === "number"
  ) {
    return Response.json({
      averageRating: meta.averageRating ?? null,
      totalReviewCount: meta.totalReviewCount ?? 0,
      sync,
    });
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
