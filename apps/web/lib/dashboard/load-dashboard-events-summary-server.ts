import "server-only";

import type { DashboardEventsSummary } from "@/lib/dashboard/dashboard-module-summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardEventsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardEventsSummary> {
  const nowIso = new Date().toISOString();
  const [{ count: total }, { count: upcoming }, { count: draft }] =
    await Promise.all([
      sb
        .from("gwada_events")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .neq("status", "cancelled"),
      sb
        .from("gwada_events")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .neq("status", "cancelled")
        .gte("start_at", nowIso),
      sb
        .from("gwada_events")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("status", "draft"),
    ]);

  return {
    total: total ?? 0,
    upcoming: upcoming ?? 0,
    draft: draft ?? 0,
  };
}
