"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { QueryClient } from "@tanstack/react-query";
import { localDayKey } from "@/lib/reservations/month-range";
import {
  currentMonthReservationRange,
  peekReservationsMonthCache,
} from "@/lib/reservations/reservations-month-client-cache";
import { reservationsMonthQueryOptions } from "@/lib/reservations/reservations-list-query";
import { staffDayStatsQueryOptions } from "@/lib/staff/staff-day-stats-query";
import {
  peekStaffListQueryPlaceholder,
  staffListQueryOptions,
} from "@/lib/staff/staff-list-query";
import { queryKeys } from "@/lib/query/query-keys";
import { warmPublicHolidaysForCurrentMonth } from "@/lib/reservations/public-holidays-range-cache";

function normalizeModuleHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/** React-Query aus sessionStorage/memory — sofort renderbar vor dem Netzwerk. */
export function seedPriorityModuleQueryCaches(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  const staff = peekStaffListQueryPlaceholder(restaurantId);
  if (staff) {
    queryClient.setQueryData(queryKeys.staff.list(restaurantId), staff);
  }

  const range = currentMonthReservationRange();
  const reservations = peekReservationsMonthCache(restaurantId, range)?.rows;
  if (reservations) {
    queryClient.setQueryData(
      queryKeys.reservations.month(
        restaurantId,
        range.rangeStartIso,
        range.rangeEndExclusiveIso,
      ),
      reservations,
    );
  }
}

/** Mitarbeiter + Reservierungen zuerst — langsamste Erstbesuche. */
export function prefetchCriticalModuleQueries(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  void ensureCriticalModuleDataReady(queryClient, restaurantId);
}

export function isCriticalModuleDataReady(
  queryClient: QueryClient,
  restaurantId: string,
): boolean {
  const staff = queryClient.getQueryData(queryKeys.staff.list(restaurantId));
  const range = currentMonthReservationRange();
  const reservations = queryClient.getQueryData(
    queryKeys.reservations.month(
      restaurantId,
      range.rangeStartIso,
      range.rangeEndExclusiveIso,
    ),
  );
  return staff != null && reservations != null;
}

export async function ensureCriticalModuleDataReady(
  queryClient: QueryClient,
  restaurantId: string,
): Promise<void> {
  seedPriorityModuleQueryCaches(queryClient, restaurantId);
  const dayDate = localDayKey(new Date());
  const range = currentMonthReservationRange();
  await Promise.allSettled([
    queryClient.prefetchQuery(staffListQueryOptions(restaurantId)),
    queryClient.prefetchQuery(
      staffDayStatsQueryOptions(restaurantId, dayDate),
    ),
    queryClient.prefetchQuery(
      reservationsMonthQueryOptions(restaurantId, range),
    ),
    warmPublicHolidaysForCurrentMonth(restaurantId),
  ]);
}

const MODULE_HREF_PREFIX: readonly { prefix: string; warm: "staff" | "reservations" }[] =
  [
    { prefix: "/dashboard/mitarbeiter", warm: "staff" },
    { prefix: "/dashboard/reservierungen", warm: "reservations" },
  ];

function warmModuleData(
  queryClient: QueryClient,
  restaurantId: string,
  href: string,
): void {
  const path = normalizeModuleHref(href);
  for (const { prefix, warm } of MODULE_HREF_PREFIX) {
    if (!path.startsWith(prefix)) continue;
    if (warm === "staff") {
      seedPriorityModuleQueryCaches(queryClient, restaurantId);
      prefetchCriticalModuleQueries(queryClient, restaurantId);
      return;
    }
    if (warm === "reservations") {
      seedPriorityModuleQueryCaches(queryClient, restaurantId);
      void queryClient.prefetchQuery(
        reservationsMonthQueryOptions(
          restaurantId,
          currentMonthReservationRange(),
        ),
      );
      void warmPublicHolidaysForCurrentMonth(restaurantId);
      return;
    }
  }
}

/** Hover/Focus: RSC-Flight + Modul-Daten vor dem Klick wärmen. */
export function warmModuleRouteIntent(
  router: AppRouterInstance,
  queryClient: QueryClient,
  restaurantId: string,
  href: string,
): void {
  router.prefetch(href);
  warmModuleData(queryClient, restaurantId, href);
}
