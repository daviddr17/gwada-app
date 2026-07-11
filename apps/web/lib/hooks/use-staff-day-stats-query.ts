"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import { staffDayStatsQueryOptions } from "@/lib/staff/staff-day-stats-query";
import { queryKeys } from "@/lib/query/query-keys";

export function useStaffDayStatsQuery(
  restaurantId: string | null,
  dayDate: string,
) {
  const queryClient = useQueryClient();
  const enabled = Boolean(restaurantId && dayDate);

  const query = useQuery({
    ...staffDayStatsQueryOptions(restaurantId ?? "", dayDate),
    enabled,
  });

  const invalidate = useCallback(() => {
    if (!restaurantId || !dayDate) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.staff.dayStats(restaurantId, dayDate),
    });
  }, [queryClient, restaurantId, dayDate]);

  useEffect(() => {
    if (!restaurantId) return;
    const onRefresh = () => invalidate();
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
  }, [restaurantId, invalidate]);

  const data = query.data;

  return {
    workingIds: data?.workingIds ?? new Set<string>(),
    breakIds: data?.breakIds ?? new Set<string>(),
    presenceRows: data?.presenceRows ?? [],
    dayEntries: data?.dayEntries ?? [],
    lastDisplayLoginByStaffId:
      data?.lastDisplayLoginByStaffId ?? new Map<string, string>(),
    isLoading: query.isLoading && !data,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}
