import { NextResponse } from "next/server";
import {
  parseNewsPlatformFilter,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import {
  isNewsCacheablePlatform,
  type NewsCacheablePlatform,
} from "@/lib/news/news-cache-constants";
import { readNewsFeedFromCache } from "@/lib/news/news-feed-read-server";
import { readNewsStoriesFromCache } from "@/lib/news/news-stories-read-server";
import { syncRestaurantNewsPlatforms } from "@/lib/news/news-feed-sync-server";
import { syncRestaurantNewsStoriesPlatforms } from "@/lib/news/news-stories-sync-server";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    platform?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const filter = parseNewsPlatformFilter(body.platform ?? null);
  const requestedPlatforms =
    filter === "all" ? undefined : ([filter] as NewsPlatform[]);

  if (filter !== "all" && !isNewsCacheablePlatform(filter)) {
    const { items, sync } = await readNewsFeedFromCache(
      restaurantId,
      auth.sb,
      requestedPlatforms,
    );
    return NextResponse.json({ items, count: items.length, sync });
  }

  const cacheablePlatforms =
    filter === "all" ? undefined : [filter as NewsCacheablePlatform];
  const result = await syncRestaurantNewsPlatforms(
    admin,
    restaurantId,
    cacheablePlatforms,
  );
  void syncRestaurantNewsStoriesPlatforms(admin, restaurantId);
  const [{ items, sync }, { storyRings, storiesSync }] = await Promise.all([
    readNewsFeedFromCache(restaurantId, auth.sb, requestedPlatforms),
    readNewsStoriesFromCache(restaurantId, auth.sb),
  ]);

  return NextResponse.json({
    items,
    count: items.length,
    sync,
    storyRings,
    storiesSync,
    syncedItems: result.synced,
    errors: result.errors,
  });
}
