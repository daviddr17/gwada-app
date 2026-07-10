import { computeDashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import {
  restaurantFromTodayUtcIsoRange,
  restaurantWeekRangeUtcIso,
} from "@/lib/reservations/dashboard-period-range";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import { fetchReservationsForRestaurant } from "@/lib/supabase/reservations-db";
import { fetchRestaurantIanaTimezone } from "@/lib/supabase/restaurant-timezone-db";

export async function loadDashboardReservationSummary(
  restaurantId: string,
): Promise<{ summary: DashboardReservationSummary | null; error: Error | null }> {
  const timeZone = await fetchRestaurantIanaTimezone(restaurantId);
  const week = restaurantWeekRangeUtcIso(timeZone);
  const upcoming = restaurantFromTodayUtcIsoRange(timeZone);

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
    summary: computeDashboardReservationSummary(
      weekRes.data,
      upcomingRes.data,
      timeZone,
    ),
    error: null,
  };
}
