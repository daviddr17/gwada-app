import "server-only";

import { computeDashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import {
  fromTodayUtcIsoRange,
  weekRangeUtcIso,
} from "@/lib/reservations/dashboard-period-range";
import {
  mapRawToReservationListRow,
  RESERVATION_LIST_ROW_SELECT,
} from "@/lib/supabase/reservations-db";
import type { SupabaseClient } from "@supabase/supabase-js";

async function fetchReservationsRangeServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    rangeStartIso: string;
    rangeEndExclusiveIso: string;
  },
) {
  const { data, error } = await sb
    .from("reservations")
    .select(RESERVATION_LIST_ROW_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .gte("starts_at", params.rangeStartIso)
    .lt("starts_at", params.rangeEndExclusiveIso)
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    mapRawToReservationListRow(row as Record<string, unknown>),
  );
}

export async function loadDashboardReservationSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardReservationSummary> {
  const week = weekRangeUtcIso();
  const upcoming = fromTodayUtcIsoRange();

  const [weekRows, upcomingRows] = await Promise.all([
    fetchReservationsRangeServer(sb, {
      restaurantId,
      rangeStartIso: week.rangeStartIso,
      rangeEndExclusiveIso: week.rangeEndExclusiveIso,
    }),
    fetchReservationsRangeServer(sb, {
      restaurantId,
      rangeStartIso: upcoming.rangeStartIso,
      rangeEndExclusiveIso: upcoming.rangeEndExclusiveIso,
    }),
  ]);

  return computeDashboardReservationSummary(weekRows, upcomingRows);
}
