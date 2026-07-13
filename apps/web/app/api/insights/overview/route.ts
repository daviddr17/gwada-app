import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import {
  fetchInsightsOverview,
  type InsightsPeriodDays,
} from "@/lib/insights/insights-overview-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

function parsePeriodDays(raw: string | null): InsightsPeriodDays {
  const n = Number.parseInt(raw ?? "30", 10);
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const periodDays = parsePeriodDays(
    new URL(req.url).searchParams.get("periodDays"),
  );

  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeModuleCrud(restaurantId, "insights", "read");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await fetchInsightsOverview(auth.sb, restaurantId, periodDays);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
