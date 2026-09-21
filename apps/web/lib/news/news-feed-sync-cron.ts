import "server-only";

import { shouldSyncRestaurantInCronSlot } from "@/lib/ops/cron-restaurant-stagger";
import { syncRestaurantNewsPlatforms } from "@/lib/news/news-feed-sync-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsFeedSyncCronStats = {
  restaurants: number;
  syncedItems: number;
  skipped: number;
  errors: string[];
};

const CRON_STAGGER_BUCKETS = 10;

export async function runNewsFeedSyncCron(
  admin: SupabaseClient,
  options?: { forceAll?: boolean },
): Promise<NewsFeedSyncCronStats> {
  const stats: NewsFeedSyncCronStats = {
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
    if (
      !options?.forceAll &&
      !shouldSyncRestaurantInCronSlot(restaurantId, CRON_STAGGER_BUCKETS)
    ) {
      stats.skipped += 1;
      continue;
    }
    const result = await syncRestaurantNewsPlatforms(admin, restaurantId);
    stats.syncedItems += result.synced;
    stats.errors.push(...result.errors.map((e) => `${restaurantId}:${e}`));
  }

  return stats;
}
