import "server-only";

import type { DashboardDocumentsSummary } from "@/lib/dashboard/dashboard-module-summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardDocumentsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardDocumentsSummary> {
  const [totalRes, withoutTagRes, usageRes] = await Promise.all([
    sb
      .from("restaurant_documents")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    sb
      .from("restaurant_documents")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .is("tag_id", null),
    sb.rpc("restaurant_documents_used_bytes", {
      p_restaurant_id: restaurantId,
    }),
  ]);

  if (totalRes.error) throw new Error(totalRes.error.message);
  if (withoutTagRes.error) throw new Error(withoutTagRes.error.message);

  const usageBytes =
    typeof usageRes.data === "number"
      ? usageRes.data
      : Array.isArray(usageRes.data) && typeof usageRes.data[0] === "number"
        ? usageRes.data[0]
        : 0;

  return {
    total: totalRes.count ?? 0,
    withoutTag: withoutTagRes.count ?? 0,
    storageBytes: usageBytes,
  };
}
