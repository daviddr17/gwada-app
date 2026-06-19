import { after, NextResponse } from "next/server";
import {
  parseNewsPlatformFilter,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import { readNewsFeedFromCache } from "@/lib/news/news-feed-read-server";
import { readNewsStoriesFromCache } from "@/lib/news/news-stories-read-server";
import { triggerNewsFeedSyncIfStale } from "@/lib/news/news-feed-sync-server";
import { triggerNewsStoriesSyncIfStale } from "@/lib/news/news-stories-sync-server";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const filter = parseNewsPlatformFilter(url.searchParams.get("platform"));
  const platforms =
    filter === "all" ? undefined : ([filter] as NewsPlatform[]);

  const [{ items, sync }, { storyRings, storiesSync }] = await Promise.all([
    readNewsFeedFromCache(restaurantId, auth.sb, platforms),
    readNewsStoriesFromCache(restaurantId, auth.sb),
  ]);

  after(() => {
    void triggerNewsFeedSyncIfStale(restaurantId, platforms);
    void triggerNewsStoriesSyncIfStale(restaurantId);
  });

  return NextResponse.json({
    items,
    count: items.length,
    sync,
    storyRings,
    storiesSync,
  });
}
