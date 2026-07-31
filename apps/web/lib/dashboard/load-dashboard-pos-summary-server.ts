import "server-only";

import type { DashboardPosSummary } from "@/lib/dashboard/dashboard-module-summary-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardPosSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardPosSummary> {
  const admin = createSupabaseAdminClient();
  let startAt: string | null = null;
  let endAt: string | null = null;
  if (admin) {
    const { data: bounds } = await admin.rpc("pos_restaurant_today_bounds", {
      p_restaurant_id: restaurantId,
    });
    const row = bounds?.[0] as { start_at?: string; end_at?: string } | undefined;
    startAt = row?.start_at ?? null;
    endAt = row?.end_at ?? null;
  }

  const openSessionsPromise = sb
    .from("pos_table_sessions")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "open");

  if (!startAt || !endAt) {
    const { count: openSessions } = await openSessionsPromise;
    return {
      ordersToday: 0,
      revenueCentsToday: 0,
      avgTicketCentsToday: null,
      openSessions: openSessions ?? 0,
    };
  }

  const [{ data: orderRows }, { count: openSessions }] = await Promise.all([
    sb
      .from("pos_orders")
      .select("total_cents")
      .eq("restaurant_id", restaurantId)
      .eq("status", "delivered")
      .gte("closed_at", startAt)
      .lt("closed_at", endAt),
    openSessionsPromise,
  ]);

  const orders = orderRows ?? [];
  const revenueCentsToday = orders.reduce(
    (sum, row) => sum + (Number(row.total_cents) || 0),
    0,
  );
  const ordersToday = orders.length;

  return {
    ordersToday,
    revenueCentsToday,
    avgTicketCentsToday:
      ordersToday > 0 ? Math.round(revenueCentsToday / ordersToday) : null,
    openSessions: openSessions ?? 0,
  };
}
