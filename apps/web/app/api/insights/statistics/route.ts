import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import {
  fetchInsightsStatistics,
  type InsightsStatisticsPeriodInput,
} from "@/lib/insights/insights-statistics-server";
import type {
  InsightsStatsDays,
  InsightsStatsPeriod,
} from "@/lib/insights/compute-insights-statistics";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

function parseMonthsBack(raw: string | null): InsightsStatsPeriod | null {
  const n = Number.parseInt(raw ?? "", 10);
  if (n === 3 || n === 6 || n === 12) return n;
  return null;
}

function parseDaysBack(raw: string | null): InsightsStatsDays | null {
  const n = Number.parseInt(raw ?? "", 10);
  if (n === 7 || n === 28 || n === 30 || n === 90) return n;
  return null;
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const restaurantId = searchParams.get("restaurantId")?.trim() ?? "";
  const daysBack = parseDaysBack(searchParams.get("daysBack"));
  const monthsBack = parseMonthsBack(searchParams.get("monthsBack"));

  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const periodInput: InsightsStatisticsPeriodInput = daysBack
    ? { daysBack }
    : { monthsBack: monthsBack ?? 12 };

  const auth = await authorizeModuleCrud(restaurantId, "insights", "read");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await fetchInsightsStatistics(
    auth.sb,
    restaurantId,
    periodInput,
  );
  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json(result.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
