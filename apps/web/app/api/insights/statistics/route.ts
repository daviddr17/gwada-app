import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import {
  fetchInsightsStatistics,
} from "@/lib/insights/insights-statistics-server";
import type { InsightsStatsPeriod } from "@/lib/insights/compute-insights-statistics";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

function parseMonthsBack(raw: string | null): InsightsStatsPeriod {
  const n = Number.parseInt(raw ?? "12", 10);
  if (n === 3 || n === 6 || n === 12) return n;
  return 12;
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const restaurantId = searchParams.get("restaurantId")?.trim() ?? "";
  const monthsBack = parseMonthsBack(searchParams.get("monthsBack"));

  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeModuleCrud(restaurantId, "insights", "read");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await fetchInsightsStatistics(auth.sb, restaurantId, monthsBack);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json(result.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
