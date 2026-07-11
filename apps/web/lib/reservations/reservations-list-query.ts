"use client";

import type { QueryClient } from "@tanstack/react-query";
import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import { queryKeys } from "@/lib/query/query-keys";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import {
  fetchReservationsForRestaurant,
  fetchUnconfirmedReservationsForRestaurant,
} from "@/lib/supabase/reservations-db";
import {
  peekReservationsMonthCache,
  writeReservationsMonthCache,
  type ReservationsMonthRange,
} from "@/lib/reservations/reservations-month-client-cache";

export async function fetchReservationsMonthList(
  restaurantId: string,
  range: ReservationsMonthRange,
): Promise<ReservationListRow[]> {
  const { data, error } = await fetchReservationsForRestaurant({
    restaurantId,
    rangeStartIso: range.rangeStartIso,
    rangeEndExclusiveIso: range.rangeEndExclusiveIso,
  });
  if (error) throw new Error(error.message);
  writeReservationsMonthCache(restaurantId, range, data);
  return data;
}

export async function fetchReservationsUnconfirmedList(
  restaurantId: string,
): Promise<ReservationListRow[]> {
  const { data, error } =
    await fetchUnconfirmedReservationsForRestaurant(restaurantId);
  if (error) throw new Error(error.message);
  return data;
}

export function reservationsMonthQueryOptions(
  restaurantId: string,
  range: ReservationsMonthRange,
) {
  return {
    queryKey: queryKeys.reservations.month(
      restaurantId,
      range.rangeStartIso,
      range.rangeEndExclusiveIso,
    ),
    queryFn: () => fetchReservationsMonthList(restaurantId, range),
    staleTime: getModuleCacheStaleTime("reservationsLive") ?? 60_000,
    gcTime: getModuleCacheGcTime("reservationsLive") ?? 5 * 60_000,
  };
}

export function reservationsUnconfirmedQueryOptions(restaurantId: string) {
  return {
    queryKey: queryKeys.reservations.unconfirmed(restaurantId),
    queryFn: () => fetchReservationsUnconfirmedList(restaurantId),
    staleTime: getModuleCacheStaleTime("reservationsLive") ?? 60_000,
    gcTime: getModuleCacheGcTime("reservationsLive") ?? 5 * 60_000,
  };
}

export function peekReservationsMonthQueryPlaceholder(
  restaurantId: string,
  range: ReservationsMonthRange,
): ReservationListRow[] | undefined {
  return peekReservationsMonthCache(restaurantId, range)?.rows;
}

export function patchReservationsMonthQueryCache(
  queryClient: QueryClient,
  restaurantId: string,
  range: ReservationsMonthRange,
  updater: (prev: ReservationListRow[]) => ReservationListRow[],
): void {
  queryClient.setQueryData<ReservationListRow[]>(
    queryKeys.reservations.month(
      restaurantId,
      range.rangeStartIso,
      range.rangeEndExclusiveIso,
    ),
    (prev) => {
      const base = prev ?? [];
      const next = updater(base);
      writeReservationsMonthCache(restaurantId, range, next);
      return next;
    },
  );
}
