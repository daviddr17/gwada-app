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
import type { ReservationOpenResolvedDetail } from "@/lib/reservations/reservation-open-status";
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

function patchReservationRowStatus(
  row: ReservationListRow,
  detail: ReservationOpenResolvedDetail,
): ReservationListRow {
  const nextName =
    detail.nextStatus?.name ??
    (detail.nextStatusCode === "confirmed"
      ? "Bestätigt"
      : detail.nextStatusCode);
  const st = row.reservation_statuses;
  return {
    ...row,
    reservation_statuses: st
      ? {
          ...st,
          id: detail.nextStatus?.id ?? st.id,
          code: detail.nextStatusCode,
          name: nextName,
          color_hex: detail.nextStatus?.color_hex ?? st.color_hex,
        }
      : {
          id: detail.nextStatus?.id ?? "",
          code: detail.nextStatusCode,
          name: nextName,
          color_hex: detail.nextStatus?.color_hex ?? "",
        },
  };
}

/** Sofort-Patch für Reservierungs-Listen (Unbestätigt + Monats-Queries). */
export function patchReservationOpenResolvedInQueryCaches(
  queryClient: QueryClient,
  restaurantId: string,
  detail: ReservationOpenResolvedDetail,
): void {
  queryClient.setQueryData<ReservationListRow[]>(
    queryKeys.reservations.unconfirmed(restaurantId),
    (prev) => prev?.filter((r) => r.id !== detail.reservationId) ?? prev,
  );

  for (const [key, data] of queryClient.getQueriesData<ReservationListRow[]>({
    queryKey: queryKeys.reservations.root(restaurantId),
  })) {
    if (key[2] !== "month" || !data) continue;
    const rangeStartIso = key[3];
    const rangeEndExclusiveIso = key[4];
    if (
      typeof rangeStartIso !== "string" ||
      typeof rangeEndExclusiveIso !== "string"
    ) {
      continue;
    }
    let changed = false;
    const next = data.map((row) => {
      if (row.id !== detail.reservationId) return row;
      changed = true;
      return patchReservationRowStatus(row, detail);
    });
    if (!changed) continue;
    queryClient.setQueryData(key, next);
    writeReservationsMonthCache(restaurantId, {
      rangeStartIso,
      rangeEndExclusiveIso,
    }, next);
  }
}
