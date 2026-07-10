import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { searchDashboardGlobal } from "@/lib/dashboard/dashboard-global-search-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH } from "@/lib/types/dashboard-global-search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const query = url.searchParams.get("q")?.trim() ?? "";

  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (query.length > 0 && query.length < DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
    return Response.json(
      { data: { query, groups: [] } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const sb = await createSupabaseServerClient();
  try {
    const data = await searchDashboardGlobal(
      sb,
      auth.restaurantId,
      auth.userId,
      query,
    );
    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "search_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
