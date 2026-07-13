import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import {
  parseInsightsPeriodDays,
  type InsightsFetchRangeParams,
} from "@/lib/insights/insights-date-range";
import { fetchInsightsOverview } from "@/lib/insights/insights-overview-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

function parseRangeParams(searchParams: URLSearchParams): InsightsFetchRangeParams {
  const startYmd = searchParams.get("startYmd")?.trim() ?? "";
  const endYmd = searchParams.get("endYmd")?.trim() ?? "";
  if (startYmd && endYmd) {
    return { startYmd, endYmd };
  }
  return {
    periodDays: parseInsightsPeriodDays(searchParams.get("periodDays")),
  };
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const restaurantId = searchParams.get("restaurantId")?.trim() ?? "";
  const rangeParams = parseRangeParams(searchParams);

  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeModuleCrud(restaurantId, "insights", "read");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await fetchInsightsOverview(auth.sb, restaurantId, rangeParams);
  if ("error" in result) {
    const status = result.error === "invalid_date_range" ? 400 : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
