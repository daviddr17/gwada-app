import "server-only";

import type { DashboardInsightsSummary } from "@/lib/dashboard/dashboard-module-summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardInsightsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardInsightsSummary> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [
    { count: reservations30d },
    { data: reviewRows },
    { count: messages30d },
  ] = await Promise.all([
    sb
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .gte("starts_at", sinceIso),
    sb
      .from("gwada_reviews")
      .select("rating")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", sinceIso),
    sb
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("platform", "gwada")
      .gte("created_at", sinceIso),
  ]);

  const ratings = (reviewRows ?? [])
    .map((r) => Number(r.rating))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
        10
      : null;

  return {
    reservations30d: reservations30d ?? 0,
    avgRating,
    messages30d: messages30d ?? 0,
  };
}
