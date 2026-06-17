import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import type { StaffStatsPeriod } from "@/lib/staff/compute-staff-statistics";
import {
  fetchStaffContractsForRestaurant,
  fetchStaffForRestaurant,
  fetchStaffLivePresence,
  fetchStaffWorkEntriesInRange,
} from "@/lib/supabase/staff-db";
import { fetchScheduledShiftsInRange } from "@/lib/supabase/staff-shift-schedule-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  RestaurantStaffWorkEntryRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";

export type StaffStatisticsBundle = {
  staff: RestaurantStaffRow[];
  contracts: RestaurantStaffContractRow[];
  workEntries: RestaurantStaffWorkEntryRow[];
  shifts: RestaurantStaffScheduledShiftRow[];
  presence: StaffLivePresenceRow[];
  periodStart: Date;
  periodEnd: Date;
};

function periodRange(monthsBack: StaffStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
  rangeStartIso: string;
  rangeEndIso: string;
} {
  const periodEnd = startOfLocalDay(new Date());
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return {
    periodStart,
    periodEnd,
    rangeStartIso: periodStart.toISOString(),
    rangeEndIso: exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd),
  };
}

export async function fetchStaffStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: StaffStatsPeriod;
}): Promise<{ data: StaffStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd, rangeStartIso, rangeEndIso } =
    periodRange(months);

  const [
    staffRes,
    contractsRes,
    workRes,
    shiftsRes,
    presenceRes,
  ] = await Promise.all([
    fetchStaffForRestaurant(params.restaurantId),
    fetchStaffContractsForRestaurant(params.restaurantId),
    fetchStaffWorkEntriesInRange(
      params.restaurantId,
      null,
      rangeStartIso,
      rangeEndIso,
    ),
    fetchScheduledShiftsInRange(
      params.restaurantId,
      rangeStartIso,
      rangeEndIso,
    ),
    fetchStaffLivePresence(params.restaurantId),
  ]);

  const error =
    staffRes.error ??
    contractsRes.error ??
    workRes.error ??
    shiftsRes.error ??
    presenceRes.error ??
    null;

  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      staff: staffRes.data,
      contracts: contractsRes.data,
      workEntries: workRes.data,
      shifts: shiftsRes.data,
      presence: presenceRes.data,
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
