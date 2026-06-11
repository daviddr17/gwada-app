import { NextResponse } from "next/server";
import {
  parseNewsPlatformFilter,
  type NewsPlatform,
  isNewsPlatform,
} from "@/lib/constants/news-platforms";
import { fetchUnifiedNewsFeed } from "@/lib/news/connectors/registry";
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

  const items = await fetchUnifiedNewsFeed(restaurantId, auth.sb, platforms);

  return NextResponse.json({ items, count: items.length });
}
