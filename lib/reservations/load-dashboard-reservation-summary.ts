import { computeDashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import {
  fromTodayUtcIsoRange,
  weekRangeUtcIso,
} from "@/lib/reservations/dashboard-period-range";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import { fetchReservationsForRestaurant } from "@/lib/supabase/reservations-db";

export async function loadDashboardReservationSummary(
  restaurantId: string,
): Promise<{ summary: DashboardReservationSummary | null; error: Error | null }> {
  const week = weekRangeUtcIso();
  const upcoming = fromTodayUtcIsoRange();

  const [weekRes, upcomingRes] = await Promise.all([
    fetchReservationsForRestaurant({
      restaurantId,
      rangeStartIso: week.rangeStartIso,
      rangeEndExclusiveIso: week.rangeEndExclusiveIso,
    }),
    fetchReservationsForRestaurant({
      restaurantId,
      rangeStartIso: upcoming.rangeStartIso,
      rangeEndExclusiveIso: upcoming.rangeEndExclusiveIso,
    }),
  ]);

  const error = weekRes.error ?? upcomingRes.error;
  if (error) return { summary: null, error };

  return {
    summary: computeDashboardReservationSummary(weekRes.data, upcomingRes.data),
    error: null,
  };
}
