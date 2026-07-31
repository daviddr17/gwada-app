import "server-only";

import type { DashboardNewsSummary } from "@/lib/dashboard/dashboard-module-summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardNewsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardNewsSummary> {
  const [{ count: published }, { count: scheduled }, { count: draft }] =
    await Promise.all([
      sb
        .from("gwada_news_posts")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("status", "published"),
      sb
        .from("gwada_news_posts")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("status", "scheduled"),
      sb
        .from("gwada_news_posts")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("status", "draft"),
    ]);

  return {
    published: published ?? 0,
    scheduled: scheduled ?? 0,
    draft: draft ?? 0,
  };
}
