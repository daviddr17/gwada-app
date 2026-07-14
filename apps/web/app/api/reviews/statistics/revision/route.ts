import { after } from "next/server";
import {
  REVIEWS_CACHEABLE_PLATFORMS,
  isReviewsFeedSyncStale,
} from "@/lib/reviews/reviews-cache-constants";
import { readReviewsPlatformSyncState } from "@/lib/reviews/reviews-cache-db";
import { fetchReviewStatisticsRevisionServer } from "@/lib/reviews/reviews-statistics-server";
import { triggerReviewsFeedSyncIfStale } from "@/lib/reviews/reviews-feed-sync-server";
import type { ReviewStatsPeriod } from "@/lib/reviews/compute-review-statistics";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function parseMonthsBack(value: string | null): ReviewStatsPeriod {
  const n = Number(value);
  if (n === 3 || n === 6 || n === 12) return n;
  return 12;
}

async function maybeTriggerBackgroundSync(
  restaurantId: string,
  sb: SupabaseClient,
): Promise<boolean> {
  const syncRows = await readReviewsPlatformSyncState(sb, restaurantId, [
    ...REVIEWS_CACHEABLE_PLATFORMS,
  ]);
  const stalePlatforms = REVIEWS_CACHEABLE_PLATFORMS.filter((platform) => {
    const row = syncRows.find((entry) => entry.platform === platform);
    return isReviewsFeedSyncStale(row?.synced_at, platform, {
      lastError: row?.last_error,
      itemCount: row?.item_count,
    });
  });

  if (stalePlatforms.length > 0) {
    after(() => {
      void triggerReviewsFeedSyncIfStale(restaurantId, stalePlatforms);
    });
  }

  return stalePlatforms.length > 0;
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const restaurantId = searchParams.get("restaurantId")?.trim() ?? "";
  const monthsBack = parseMonthsBack(searchParams.get("monthsBack"));

  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: "forbidden" }, { status: auth.status });
  }

  const syncTriggered = await maybeTriggerBackgroundSync(
    restaurantId,
    auth.sb,
  );

  const { data, error } = await fetchReviewStatisticsRevisionServer(auth.sb, {
    restaurantId,
    monthsBack,
    syncTriggered,
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json(data);
}
