import "server-only";

import {
  META_DAILY_SYNC_THREAD_LIMIT,
  META_MESSAGES_PER_THREAD,
  syncRestaurantMetaInbox,
} from "@/lib/contacts/sync-restaurant-meta-inbox";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MetaInboxCronStats = {
  restaurants: number;
  facebookImported: number;
  instagramImported: number;
  errors: string[];
};

/**
 * Täglicher Meta-Messaging-Reconcile (Facebook + Instagram).
 * Während App Review: Ersatz für Webhooks. Danach: Catch-up neben Webhooks.
 */
export async function runMetaInboxSyncCron(
  admin: SupabaseClient,
): Promise<MetaInboxCronStats> {
  const stats: MetaInboxCronStats = {
    restaurants: 0,
    facebookImported: 0,
    instagramImported: 0,
    errors: [],
  };

  const { data: rows, error } = await admin
    .from("restaurant_integrations")
    .select("restaurant_id, integration_key")
    .in("integration_key", ["facebook", "instagram"])
    .eq("status", "working");

  if (error) {
    stats.errors.push(`list:${error.message}`);
    return stats;
  }

  const byRestaurant = new Map<string, Set<"facebook" | "instagram">>();
  for (const raw of rows ?? []) {
    const row = raw as {
      restaurant_id: string;
      integration_key: string;
    };
    const key =
      row.integration_key === "instagram" ? "instagram" : "facebook";
    const set = byRestaurant.get(row.restaurant_id) ?? new Set();
    set.add(key);
    byRestaurant.set(row.restaurant_id, set);
  }

  stats.restaurants = byRestaurant.size;

  for (const [restaurantId, platforms] of byRestaurant) {
    const result = await syncRestaurantMetaInbox(admin, restaurantId, {
      platforms: [...platforms],
      threadLimit: META_DAILY_SYNC_THREAD_LIMIT,
      messagesPerThread: META_MESSAGES_PER_THREAD,
      silent: true,
    });
    stats.facebookImported += result.facebookImported;
    stats.instagramImported += result.instagramImported;
    if (result.error) {
      stats.errors.push(`${restaurantId}:${result.error}`);
    }
  }

  if (
    stats.facebookImported + stats.instagramImported > 0 ||
    stats.errors.length > 0
  ) {
    console.info(
      `[meta-inbox-cron] restaurants=${stats.restaurants} fb=${stats.facebookImported} ig=${stats.instagramImported} errors=${stats.errors.length}`,
    );
  }

  return stats;
}
