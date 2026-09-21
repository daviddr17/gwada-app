import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Purchase-order tables have no `updated_at`. Revision = open-order + line + log counts.
 */
export async function fetchInventoryPurchaseOrdersLiveRevision(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<string> {
  const [openRes, linesRes, logRes] = await Promise.all([
    sb
      .from("inventory_purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "open"),
    sb
      .from("inventory_purchase_order_lines")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    sb
      .from("inventory_purchase_order_log_entries")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
  ]);

  return `${openRes.count ?? 0}|${linesRes.count ?? 0}|${logRes.count ?? 0}`;
}
