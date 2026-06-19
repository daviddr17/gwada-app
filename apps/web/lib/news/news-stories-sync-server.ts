import "server-only";

import {
  NEWS_STORIES_PLATFORMS,
  isNewsStoriesSyncStale,
  type NewsStoriesPlatform,
} from "@/lib/news/news-stories-cache-constants";
import { upsertNewsStoriesPlatformCache } from "@/lib/news/news-stories-cache-db";
import { fetchFacebookStories } from "@/lib/news/connectors/facebook-stories";
import { fetchInstagramStories } from "@/lib/news/connectors/instagram-stories";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const inFlightSync = new Set<string>();

function syncLockKey(restaurantId: string, platform: NewsStoriesPlatform): string {
  return `${restaurantId}:stories:${platform}`;
}

async function getInstagramAuth(restaurantId: string) {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "instagram",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return { error: "instagram_not_connected" as const };
  const igId = row.config.instagram_business_account_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!igId || !token) return { error: "instagram_token_missing" as const };
  return { igId, token };
}

async function getFacebookAuth(restaurantId: string) {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return { error: "facebook_not_connected" as const };
  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) return { error: "facebook_token_missing" as const };
  return { pageId, token };
}

export async function syncRestaurantNewsStoriesPlatform(
  admin: SupabaseClient,
  restaurantId: string,
  platform: NewsStoriesPlatform,
): Promise<{ ok: boolean; error?: string; count: number }> {
  const lockKey = syncLockKey(restaurantId, platform);
  if (inFlightSync.has(lockKey)) {
    return { ok: true, count: 0 };
  }
  inFlightSync.add(lockKey);

  try {
    const syncedAt = new Date().toISOString();

    if (platform === "instagram") {
      const auth = await getInstagramAuth(restaurantId);
      if ("error" in auth) {
        await upsertNewsStoriesPlatformCache(admin, restaurantId, platform, [], syncedAt, null);
        return { ok: true, count: 0 };
      }
      const fetched = await fetchInstagramStories(restaurantId, auth);
      if (!fetched.ok) {
        await upsertNewsStoriesPlatformCache(
          admin,
          restaurantId,
          platform,
          [],
          syncedAt,
          fetched.error,
        );
        return { ok: false, error: fetched.error, count: 0 };
      }
      await upsertNewsStoriesPlatformCache(
        admin,
        restaurantId,
        platform,
        fetched.slides,
        syncedAt,
        null,
      );
      return { ok: true, count: fetched.slides.length };
    }

    const auth = await getFacebookAuth(restaurantId);
    if ("error" in auth) {
      await upsertNewsStoriesPlatformCache(admin, restaurantId, platform, [], syncedAt, null);
      return { ok: true, count: 0 };
    }
    const fetched = await fetchFacebookStories(auth);
    if (!fetched.ok) {
      await upsertNewsStoriesPlatformCache(
        admin,
        restaurantId,
        platform,
        [],
        syncedAt,
        fetched.error,
      );
      return { ok: false, error: fetched.error, count: 0 };
    }
    await upsertNewsStoriesPlatformCache(
      admin,
      restaurantId,
      platform,
      fetched.slides,
      syncedAt,
      null,
    );
    return { ok: true, count: fetched.slides.length };
  } finally {
    inFlightSync.delete(lockKey);
  }
}

export async function syncRestaurantNewsStoriesPlatforms(
  admin: SupabaseClient,
  restaurantId: string,
  platforms?: NewsStoriesPlatform[],
): Promise<{ synced: number; errors: string[] }> {
  const keys = platforms ?? [...NEWS_STORIES_PLATFORMS];
  const stats = { synced: 0, errors: [] as string[] };

  await Promise.all(
    keys.map(async (platform) => {
      const result = await syncRestaurantNewsStoriesPlatform(admin, restaurantId, platform);
      if (result.ok) {
        stats.synced += result.count;
      } else if (result.error) {
        stats.errors.push(`${platform}:${result.error}`);
      }
    }),
  );

  return stats;
}

export async function triggerNewsStoriesSyncIfStale(
  restaurantId: string,
  platforms?: NewsStoriesPlatform[],
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const keys = platforms ?? [...NEWS_STORIES_PLATFORMS];

  const { data } = await admin
    .from("restaurant_news_stories_sync")
    .select("platform, synced_at")
    .eq("restaurant_id", restaurantId)
    .in("platform", keys);

  const syncedByPlatform = new Map(
    (data ?? []).map((row) => [row.platform as string, row.synced_at as string | null]),
  );

  const stale = keys.filter((platform) =>
    isNewsStoriesSyncStale(syncedByPlatform.get(platform)),
  );
  if (stale.length === 0) return;

  void syncRestaurantNewsStoriesPlatforms(admin, restaurantId, stale);
}

export async function syncRestaurantNewsStoriesAfterPublish(
  restaurantId: string,
  platform: NewsStoriesPlatform,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  void syncRestaurantNewsStoriesPlatform(admin, restaurantId, platform);
}
