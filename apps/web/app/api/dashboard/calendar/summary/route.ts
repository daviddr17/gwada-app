import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { loadDashboardCalendarSummaryServer } from "@/lib/dashboard/load-dashboard-calendar-summary-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const month = url.searchParams.get("month")?.trim() ?? "";

  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: "invalid_month" }, { status: 400 });
  }

  try {
    const data = await loadDashboardCalendarSummaryServer(
      auth.sb,
      auth.restaurantId,
      month,
    );
    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "load_failed";
    const status = message === "invalid_month" ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
