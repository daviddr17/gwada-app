import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { LIVE_ACTIVITY_FEED_MODULES } from "@/lib/live-activity/live-activity-feed-modules";
import { liveActivityFromNotificationEvent } from "@/lib/live-activity/live-activity-from-notification-event";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { startOfRestaurantCalendarDay } from "@/lib/restaurant/restaurant-timezone";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";

export const dynamic = "force-dynamic";

export async function fetchLiveActivityFeedToday(
  restaurantId: string,
): Promise<LiveActivityItem[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const timeZone = await fetchRestaurantTimezoneServer(admin, restaurantId);
  const since = startOfRestaurantCalendarDay(new Date(), timeZone).toISOString();

  const { data, error } = await admin
    .from("notification_events")
    .select("id, module, payload, created_at")
    .eq("restaurant_id", restaurantId)
    .in("module", [...LIVE_ACTIVITY_FEED_MODULES])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.warn("[live-activity-feed]", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const mapped = liveActivityFromNotificationEvent({
      eventId: row.id as string,
      module: row.module as string,
      payload: (row.payload as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    });
    return {
      id: mapped.id ?? `evt:${row.id}`,
      kind: mapped.kind,
      module: mapped.module,
      title: mapped.title,
      description: mapped.description ?? null,
      href: mapped.href ?? null,
      at: mapped.at ?? (row.created_at as string),
    };
  });
}

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const items = await fetchLiveActivityFeedToday(auth.restaurantId);
  return Response.json({ data: items });
}
