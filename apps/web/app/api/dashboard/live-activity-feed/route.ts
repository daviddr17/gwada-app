import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { LIVE_ACTIVITY_FEED_MODULES } from "@/lib/live-activity/live-activity-feed-modules";
import { liveActivityFromNotificationEvent } from "@/lib/live-activity/live-activity-from-notification-event";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function fetchLiveActivityFeed(params: {
  restaurantId: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: LiveActivityItem[]; hasMore: boolean; total: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { items: [], hasMore: false, total: 0 };
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, params.limit ?? DEFAULT_LIMIT),
  );
  const offset = Math.max(0, params.offset ?? 0);

  const { data, error, count } = await admin
    .from("notification_events")
    .select("id, module, reference_id, payload, created_at", { count: "exact" })
    .eq("restaurant_id", params.restaurantId)
    .in("module", [...LIVE_ACTIVITY_FEED_MODULES])
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.warn("[live-activity-feed]", error.message);
    return { items: [], hasMore: false, total: 0 };
  }

  const items = (data ?? []).map((row) => {
    const mapped = liveActivityFromNotificationEvent({
      eventId: row.id as string,
      referenceId: row.reference_id as string | undefined,
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

  const total = count ?? items.length;
  const hasMore = offset + items.length < total;

  return { items, hasMore, total };
}

/** @deprecated Alias für Tests — heute = offset 0, limit 80 */
export async function fetchLiveActivityFeedToday(
  restaurantId: string,
): Promise<LiveActivityItem[]> {
  const { items } = await fetchLiveActivityFeed({
    restaurantId,
    limit: 80,
    offset: 0,
  });
  return items;
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const restaurantId = searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const limit = Number(searchParams.get("limit"));
  const offset = Number(searchParams.get("offset"));

  const page = await fetchLiveActivityFeed({
    restaurantId: auth.restaurantId,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  });

  return Response.json({
    data: page.items,
    hasMore: page.hasMore,
    total: page.total,
  });
}
