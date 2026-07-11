"use client";

import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import { queryKeys } from "@/lib/query/query-keys";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayStartToUtcIso,
} from "@/lib/reservations/month-range";
import {
  fetchStaffLastDisplayLoginByStaffId,
  fetchStaffLivePresence,
  fetchStaffWorkEntriesInRange,
} from "@/lib/supabase/staff-db";
import type {
  RestaurantStaffWorkEntryRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";

export type StaffDayStatsQueryData = {
  workingIds: Set<string>;
  breakIds: Set<string>;
  presenceRows: StaffLivePresenceRow[];
  dayEntries: RestaurantStaffWorkEntryRow[];
  lastDisplayLoginByStaffId: Map<string, string>;
};

async function fetchStaffDayStats(
  restaurantId: string,
  dayDate: string,
): Promise<StaffDayStatsQueryData> {
  const [y, m, d] = dayDate.split("-").map(Number);
  const day = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const start = localDayStartToUtcIso(day);
  const end = exclusiveUtcIsoAfterLocalVisibleEnd(day);

  const [
    { data: presence, error: presenceErr },
    { data: entries, error: entriesErr },
    { data: displayLogins, error: displayLoginErr },
  ] = await Promise.all([
    fetchStaffLivePresence(restaurantId),
    fetchStaffWorkEntriesInRange(restaurantId, null, start, end),
    fetchStaffLastDisplayLoginByStaffId(restaurantId),
  ]);

  if (presenceErr) throw new Error(presenceErr);
  if (entriesErr) throw new Error(entriesErr);
  if (displayLoginErr) throw new Error(displayLoginErr);

  const workingIds = new Set<string>();
  const breakIds = new Set<string>();
  for (const s of presence) {
    if (s.status === "on_break") breakIds.add(s.staff_id);
    else if (s.status === "working") workingIds.add(s.staff_id);
  }

  return {
    workingIds,
    breakIds,
    presenceRows: presence,
    dayEntries: entries,
    lastDisplayLoginByStaffId: displayLogins,
  };
}

export function staffDayStatsQueryOptions(
  restaurantId: string,
  dayDate: string,
) {
  return {
    queryKey: queryKeys.staff.dayStats(restaurantId, dayDate),
    queryFn: () => fetchStaffDayStats(restaurantId, dayDate),
    staleTime: getModuleCacheStaleTime("staffLive") ?? 30_000,
    gcTime: getModuleCacheGcTime("staffLive") ?? 5 * 60_000,
  };
}
