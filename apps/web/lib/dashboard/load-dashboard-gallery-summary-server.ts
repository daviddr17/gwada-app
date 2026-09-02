import "server-only";

import type { DashboardGallerySummary } from "@/lib/dashboard/dashboard-module-summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardGallerySummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardGallerySummary> {
  const [mediaRes, highlightsRes] = await Promise.all([
    sb
      .from("gwada_gallery_items")
      .select("size_bytes")
      .eq("restaurant_id", restaurantId),
    sb
      .from("gwada_gallery_highlights")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
  ]);

  if (mediaRes.error) throw new Error(mediaRes.error.message);
  if (highlightsRes.error) throw new Error(highlightsRes.error.message);

  const rows = mediaRes.data ?? [];
  const storageBytes = rows.reduce(
    (sum, row) => sum + (Number((row as { size_bytes?: number }).size_bytes) || 0),
    0,
  );

  return {
    mediaTotal: rows.length,
    highlights: highlightsRes.count ?? 0,
    storageBytes,
  };
}
