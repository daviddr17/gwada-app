import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  EVENTS_CACHEABLE_PLATFORMS,
  isEventsCacheablePlatform,
  type EventsCacheablePlatform,
  type EventsPlatform,
} from "@/lib/constants/events-platforms";
import { syncRestaurantEventsPlatforms } from "@/lib/events/events-feed-sync-server";
import { readEventsFeedFromCache } from "@/lib/events/events-feed-read-server";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    platform?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_config" }, { status: 500 });
  }

  const platformParam = body.platform?.trim();
  const platforms: EventsCacheablePlatform[] | undefined =
    platformParam && isEventsCacheablePlatform(platformParam as EventsPlatform)
      ? [platformParam as EventsCacheablePlatform]
      : undefined;

  await syncRestaurantEventsPlatforms(admin, restaurantId, platforms);
  const { items, sync } = await readEventsFeedFromCache(restaurantId, auth.sb);

  return NextResponse.json({ items, sync });
}
