import { after, NextResponse } from "next/server";
import {
  parseEventsPlatformFilter,
  type EventsPlatform,
} from "@/lib/constants/events-platforms";
import { readEventsFeedFromCache } from "@/lib/events/events-feed-read-server";
import { triggerEventsFeedSyncIfStale } from "@/lib/events/events-feed-sync-server";
import { sortEventsByStartAt } from "@/lib/events/format-events-display-date";
import { readPrivateEventsForDashboardFeed } from "@/lib/events/private-events-feed-server";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const filter = parseEventsPlatformFilter(url.searchParams.get("platform"));
  const platforms =
    filter === "all" ? undefined : ([filter] as EventsPlatform[]);

  const includePrivate = filter === "all";

  const [{ items: publicItems, sync }, privateItems] = await Promise.all([
    readEventsFeedFromCache(restaurantId, auth.sb, platforms),
    includePrivate
      ? readPrivateEventsForDashboardFeed(restaurantId, auth.sb)
      : Promise.resolve([]),
  ]);

  const items = sortEventsByStartAt([...publicItems, ...privateItems]);

  after(() => {
    void triggerEventsFeedSyncIfStale(restaurantId, platforms);
  });

  return NextResponse.json({ items, count: items.length, sync });
}
