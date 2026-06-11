import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { fetchNotificationSummaryServer } from "@/lib/notifications/notification-summary-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const data = await fetchNotificationSummaryServer(sb, admin, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
  });

  return Response.json({ data });
}
