"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import {
  peekStaffListQueryPlaceholder,
  staffListQueryOptions,
} from "@/lib/staff/staff-list-query";
import { queryKeys } from "@/lib/query/query-keys";
import { useEffect } from "react";

export function useStaffListQuery(
  restaurantId: string | null,
  workspaceReady: boolean,
) {
  const queryClient = useQueryClient();
  const enabled = workspaceReady && Boolean(restaurantId);
  const id = restaurantId ?? "";

  const options = staffListQueryOptions(id);
  const query = useQuery({
    ...options,
    enabled,
    placeholderData: (previous) =>
      previous ??
      (restaurantId ? peekStaffListQueryPlaceholder(restaurantId) : undefined),
  });

  const rows = query.data?.rows ?? [];
  const contracts = query.data?.contracts ?? [];

  const invalidate = useCallback(() => {
    if (!restaurantId) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.staff.list(restaurantId),
    });
  }, [queryClient, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const onRefresh = () => invalidate();
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
  }, [restaurantId, invalidate]);

  return {
    rows,
    contracts,
    isLoading: query.isLoading && rows.length === 0,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}
