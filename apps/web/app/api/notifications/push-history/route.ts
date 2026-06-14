import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { fetchUserNotificationPushHistory } from "@/lib/notifications/user-notification-push-history-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const restaurantId = searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const limit = Number.parseInt(searchParams.get("limit") ?? "5", 10);
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);

  const sb = await createSupabaseServerClient();
  const result = await fetchUserNotificationPushHistory(sb, {
    restaurantId: auth.restaurantId,
    limit: Number.isFinite(limit) ? limit : 5,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({
    data: {
      rows: result.rows,
      totalCount: result.totalCount,
    },
  });
}
