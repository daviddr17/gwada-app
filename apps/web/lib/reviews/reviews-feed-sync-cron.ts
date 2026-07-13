import "server-only";

import { listStaleReviewsPlatforms, syncRestaurantReviewsPlatforms } from "@/lib/reviews/reviews-feed-sync-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewsFeedSyncCronStats = {
  restaurants: number;
  syncedItems: number;
  skipped: number;
  errors: string[];
};

const CRON_STAGGER_BUCKETS = 10;

/** Verteilt Sync-Last über 10 Minuten (Hash-Bucket pro Restaurant). */
export function restaurantReviewsCronBucket(restaurantId: string): number {
  let hash = 0;
  for (let i = 0; i < restaurantId.length; i++) {
    hash = (hash * 31 + restaurantId.charCodeAt(i)) >>> 0;
  }
  return hash % CRON_STAGGER_BUCKETS;
}

export function shouldSyncRestaurantInCronSlot(
  restaurantId: string,
  slot?: number,
): boolean {
  const currentSlot =
    slot ?? Math.floor(Date.now() / 60000) % CRON_STAGGER_BUCKETS;
  return restaurantReviewsCronBucket(restaurantId) === currentSlot;
}

export async function runReviewsFeedSyncCron(
  admin: SupabaseClient,
  options?: { forceAll?: boolean },
): Promise<ReviewsFeedSyncCronStats> {
  const stats: ReviewsFeedSyncCronStats = {
    restaurants: 0,
    syncedItems: 0,
    skipped: 0,
    errors: [],
  };

  const { data: restaurants, error } = await admin.from("restaurants").select("id");
  if (error) {
    stats.errors.push(`restaurants:${error.message}`);
    return stats;
  }

  for (const row of restaurants ?? []) {
    const restaurantId = (row as { id: string }).id;
    stats.restaurants += 1;

    if (!options?.forceAll && !shouldSyncRestaurantInCronSlot(restaurantId)) {
      stats.skipped += 1;
      continue;
    }

    const stalePlatforms = await listStaleReviewsPlatforms(admin, restaurantId);
    if (stalePlatforms.length === 0) {
      stats.skipped += 1;
      continue;
    }

    const result = await syncRestaurantReviewsPlatforms(
      admin,
      restaurantId,
      stalePlatforms,
    );
    stats.syncedItems += result.synced;
    stats.errors.push(...result.errors.map((e) => `${restaurantId}:${e}`));
  }

  return stats;
}
