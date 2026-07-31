import "server-only";

import type { DashboardAccountingSummary } from "@/lib/dashboard/dashboard-module-summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardAccountingSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardAccountingSummary> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceYmd = since.toISOString().slice(0, 10);

  const [{ count: openInvoices }, { count: invoices30d }, { count: vouchers30d }] =
    await Promise.all([
      sb
        .from("accounting_invoices")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .in("status", ["open", "overdue"]),
      sb
        .from("accounting_invoices")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .gte("voucher_date", sinceYmd),
      sb
        .from("accounting_vouchers")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .gte("voucher_date", sinceYmd),
    ]);

  return {
    openInvoices: openInvoices ?? 0,
    invoices30d: invoices30d ?? 0,
    vouchers30d: vouchers30d ?? 0,
  };
}
