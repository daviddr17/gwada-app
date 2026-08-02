import "server-only";

import type { DashboardGallerySummary } from "@/lib/dashboard/dashboard-module-summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardGallerySummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardGallerySummary> {
  const [{ data: mediaRows }, { count: highlights }] = await Promise.all([
    sb
      .from("gwada_gallery_items")
      .select("size_bytes")
      .eq("restaurant_id", restaurantId),
    sb
      .from("gwada_gallery_highlights")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
  ]);

  const rows = mediaRows ?? [];
  const storageBytes = rows.reduce(
    (sum, row) => sum + (Number((row as { size_bytes?: number }).size_bytes) || 0),
    0,
  );

  return {
    mediaTotal: rows.length,
    highlights: highlights ?? 0,
    storageBytes,
  };
}
