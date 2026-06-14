import { after, NextResponse } from "next/server";
import {
  parseGalleryPlatformFilter,
  type GalleryPlatform,
} from "@/lib/constants/gallery-platforms";
import { readGalleryFeedFromCache } from "@/lib/gallery/gallery-feed-read-server";
import { triggerGalleryFeedSyncIfStale } from "@/lib/gallery/gallery-feed-sync-server";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeGalleryRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const filter = parseGalleryPlatformFilter(url.searchParams.get("platform"));
  const platforms =
    filter === "all" ? undefined : ([filter] as GalleryPlatform[]);

  const feed = await readGalleryFeedFromCache(restaurantId, auth.sb, platforms);

  after(() => {
    void triggerGalleryFeedSyncIfStale(restaurantId, platforms);
  });

  return NextResponse.json({
    items: feed.items,
    highlights: feed.highlights,
    categories: feed.categories,
    count: feed.items.length,
    sync: feed.sync,
  });
}
