import "server-only";

import type { DashboardContactsSummary } from "@/lib/contacts/compute-dashboard-contacts-summary";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardContactsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardContactsSummary> {
  const [totalRes, companyRes, reservationLinksRes] = await Promise.all([
    sb
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    sb
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .not("company", "is", null)
      .neq("company", ""),
    sb
      .from("reservations")
      .select("contact_id")
      .eq("restaurant_id", restaurantId)
      .not("contact_id", "is", null),
  ]);

  if (totalRes.error) throw new Error(totalRes.error.message);
  if (companyRes.error) throw new Error(companyRes.error.message);
  if (reservationLinksRes.error) throw new Error(reservationLinksRes.error.message);

  const withReservation = new Set(
    (reservationLinksRes.data ?? [])
      .map((r) => r.contact_id as string | null)
      .filter((id): id is string => Boolean(id)),
  ).size;

  return {
    total: totalRes.count ?? 0,
    withReservation,
    withCompany: companyRes.count ?? 0,
  };
}
