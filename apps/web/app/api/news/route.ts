import { after, NextResponse } from "next/server";
import {
  parseNewsPlatformFilter,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import { readNewsFeedFromCache } from "@/lib/news/news-feed-read-server";
import { triggerNewsFeedSyncIfStale } from "@/lib/news/news-feed-sync-server";
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

  const { items, sync } = await readNewsFeedFromCache(
    restaurantId,
    auth.sb,
    platforms,
  );

  after(() => {
    void triggerNewsFeedSyncIfStale(restaurantId, platforms);
  });

  return NextResponse.json({ items, count: items.length, sync });
}
