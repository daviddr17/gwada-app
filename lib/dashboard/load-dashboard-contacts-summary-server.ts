import "server-only";

import type { DashboardContactsSummary } from "@/lib/contacts/compute-dashboard-contacts-summary";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDashboardContactsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardContactsSummary> {
  const { count: total, error: totalErr } = await sb
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  if (totalErr) throw new Error(totalErr.message);

  const { count: withCompany, error: companyErr } = await sb
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .not("company", "is", null)
    .neq("company", "");

  if (companyErr) throw new Error(companyErr.message);

  const { data: reservationLinks, error: resErr } = await sb
    .from("reservations")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .not("contact_id", "is", null);

  if (resErr) throw new Error(resErr.message);

  const withReservation = new Set(
    (reservationLinks ?? [])
      .map((r) => r.contact_id as string | null)
      .filter((id): id is string => Boolean(id)),
  ).size;

  return {
    total: total ?? 0,
    withReservation,
    withCompany: withCompany ?? 0,
  };
}
