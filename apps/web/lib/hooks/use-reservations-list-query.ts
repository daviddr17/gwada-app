"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  peekReservationsMonthQueryPlaceholder,
  reservationsMonthQueryOptions,
  reservationsUnconfirmedQueryOptions,
} from "@/lib/reservations/reservations-list-query";
import type { ReservationsMonthRange } from "@/lib/reservations/reservations-month-client-cache";
import { queryKeys } from "@/lib/query/query-keys";

type UseReservationsListQueryArgs = {
  restaurantId: string | null;
  enabled: boolean;
  unconfirmedMode: boolean;
  range: ReservationsMonthRange;
};

export function useReservationsListQuery({
  restaurantId,
  enabled,
  unconfirmedMode,
  range,
}: UseReservationsListQueryArgs) {
  const queryClient = useQueryClient();
  const id = restaurantId ?? "";

  const monthOptions = useMemo(
    () => reservationsMonthQueryOptions(id, range),
    [id, range.rangeEndExclusiveIso, range.rangeStartIso],
  );

  const monthQuery = useQuery({
    ...monthOptions,
    enabled: enabled && Boolean(restaurantId) && !unconfirmedMode,
    placeholderData: restaurantId
      ? peekReservationsMonthQueryPlaceholder(restaurantId, range)
      : undefined,
  });

  const unconfirmedQuery = useQuery({
    ...reservationsUnconfirmedQueryOptions(id),
    enabled: enabled && Boolean(restaurantId) && unconfirmedMode,
  });

  const active = unconfirmedMode ? unconfirmedQuery : monthQuery;
  const rows = active.data ?? [];

  const invalidate = useCallback(() => {
    if (!restaurantId) return;
    if (unconfirmedMode) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reservations.unconfirmed(restaurantId),
      });
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reservations.month(
        restaurantId,
        range.rangeStartIso,
        range.rangeEndExclusiveIso,
      ),
    });
  }, [
    queryClient,
    restaurantId,
    unconfirmedMode,
    range.rangeEndExclusiveIso,
    range.rangeStartIso,
  ]);

  const invalidateAll = useCallback(() => {
    if (!restaurantId) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reservations.root(restaurantId),
    });
  }, [queryClient, restaurantId]);

  return {
    rows,
    isLoading: active.isLoading && rows.length === 0,
    isFetching: active.isFetching,
    error: active.error,
    refetch: active.refetch,
    invalidate,
    invalidateAll,
  };
}
