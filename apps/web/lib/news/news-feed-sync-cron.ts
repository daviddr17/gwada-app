import "server-only";

import { syncRestaurantNewsPlatforms } from "@/lib/news/news-feed-sync-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsFeedSyncCronStats = {
  restaurants: number;
  syncedItems: number;
  errors: string[];
};

export async function runNewsFeedSyncCron(
  admin: SupabaseClient,
): Promise<NewsFeedSyncCronStats> {
  const stats: NewsFeedSyncCronStats = {
    restaurants: 0,
    syncedItems: 0,
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
    const result = await syncRestaurantNewsPlatforms(admin, restaurantId);
    stats.syncedItems += result.synced;
    stats.errors.push(...result.errors.map((e) => `${restaurantId}:${e}`));
  }

  return stats;
}
