import "server-only";

import type { DashboardDocumentsSummary } from "@/lib/dashboard/dashboard-module-summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardDocumentsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardDocumentsSummary> {
  const [{ data: rows }, usageRes] = await Promise.all([
    sb
      .from("restaurant_documents")
      .select("id, tag_id, size_bytes")
      .eq("restaurant_id", restaurantId),
    sb.rpc("restaurant_documents_used_bytes", {
      p_restaurant_id: restaurantId,
    }),
  ]);

  const docs = rows ?? [];
  const withoutTag = docs.filter((d) => !d.tag_id).length;
  const fromRows = docs.reduce(
    (sum, d) => sum + (Number(d.size_bytes) || 0),
    0,
  );
  const usageBytes =
    typeof usageRes.data === "number"
      ? usageRes.data
      : Array.isArray(usageRes.data) && typeof usageRes.data[0] === "number"
        ? usageRes.data[0]
        : fromRows;

  return {
    total: docs.length,
    withoutTag,
    storageBytes: usageBytes,
  };
}
