import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { parseDashboardBatchWidgetsParam } from "@/lib/dashboard/dashboard-batch-widgets";
import { filterDashboardBatchWidgetsForRestaurant } from "@/lib/dashboard/filter-dashboard-batch-widgets-server";
import { loadDashboardBatchSummaryServer } from "@/lib/dashboard/load-dashboard-batch-summary-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const requested = parseDashboardBatchWidgetsParam(
    url.searchParams.get("widgets"),
  );
  const sb = await createSupabaseServerClient();
  const widgets = await filterDashboardBatchWidgetsForRestaurant(
    sb,
    auth.restaurantId,
    requested,
  );

  try {
    const { data, errors } = await loadDashboardBatchSummaryServer(
      sb,
      auth.restaurantId,
      auth.userId,
      widgets,
    );
    return Response.json(
      { data, errors },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "load_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
