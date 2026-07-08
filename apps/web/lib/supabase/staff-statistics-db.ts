import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayKey,
  localDayStartToUtcIso,
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

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function staffStatsPresetRangeYmd(monthsBack: StaffStatsPeriod): {
  startYmd: string;
  endYmd: string;
} {
  const periodEnd = startOfLocalDay(new Date());
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return {
    startYmd: localDayKey(periodStart),
    endYmd: localDayKey(periodEnd),
  };
}

function periodRangeFromMonths(monthsBack: StaffStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
  rangeStartIso: string;
  rangeEndIso: string;
} {
  const { startYmd, endYmd } = staffStatsPresetRangeYmd(monthsBack);
  const periodStart = startOfLocalDay(ymdToLocalDate(startYmd));
  const periodEnd = startOfLocalDay(ymdToLocalDate(endYmd));
  return {
    periodStart,
    periodEnd,
    rangeStartIso: localDayStartToUtcIso(periodStart),
    rangeEndIso: exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd),
  };
}

function periodRangeFromYmd(startYmd: string, endYmd: string): {
  periodStart: Date;
  periodEnd: Date;
  rangeStartIso: string;
  rangeEndIso: string;
} | null {
  if (startYmd > endYmd) return null;
  const periodStart = startOfLocalDay(ymdToLocalDate(startYmd));
  const periodEnd = startOfLocalDay(ymdToLocalDate(endYmd));
  return {
    periodStart,
    periodEnd,
    rangeStartIso: localDayStartToUtcIso(periodStart),
    rangeEndIso: exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd),
  };
}

export type FetchStaffStatisticsBundleParams =
  | {
      restaurantId: string;
      monthsBack: StaffStatsPeriod;
    }
  | {
      restaurantId: string;
      startYmd: string;
      endYmd: string;
    };

export async function fetchStaffStatisticsBundle(
  params: FetchStaffStatisticsBundleParams,
): Promise<{ data: StaffStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const range =
    "monthsBack" in params
      ? periodRangeFromMonths(params.monthsBack)
      : periodRangeFromYmd(params.startYmd, params.endYmd);

  if (!range) {
    return { data: null, error: "Ungültiger Zeitraum." };
  }

  const { periodStart, periodEnd, rangeStartIso, rangeEndIso } = range;

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
