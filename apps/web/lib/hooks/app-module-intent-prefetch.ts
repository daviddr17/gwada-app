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
import {
  inventoryIngredientsPrefetchOptions,
  menuCategoriesPrefetchOptions,
  menuItemsPrefetchOptions,
  menuMainCategoriesPrefetchOptions,
} from "@/lib/hooks/app-module-query-prefetch";
import { peekMenuItemsCache } from "@/lib/menu/menu-items-query";
import { peekMenuCategoriesCache } from "@/lib/menu/menu-categories-query";
import { peekMenuMainCategoriesCache } from "@/lib/menu/menu-main-categories-query";
import { peekIngredientsCache } from "@/lib/inventory/ingredients-query";
import {
  warmAccountingInvoices,
  warmDocumentsList,
  warmEventsFeed,
  warmGalleryFeed,
  warmInsightsOverview,
  warmNewsFeed,
  warmPosOverview,
  warmReviewsFeed,
  warmStaffTodos,
} from "@/lib/hooks/app-module-warm-prefetch";
import { APP_MODULE_PRIORITY_ROUTES } from "@/lib/navigation/app-module-priority-routes";
import { prefetchAppModuleHref } from "@/lib/navigation/prefetch-app-module-href";
import { requestModuleHomeWarmForHref } from "@/lib/navigation/module-home-warm-intent";

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

function seedMenuQueryCaches(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  const items = peekMenuItemsCache();
  if (items) {
    queryClient.setQueryData(queryKeys.menu.items(restaurantId), items);
  }
  const main = peekMenuMainCategoriesCache();
  if (main) {
    queryClient.setQueryData(queryKeys.menu.mainCategories(restaurantId), main);
  }
  const cats = peekMenuCategoriesCache();
  if (cats) {
    queryClient.setQueryData(queryKeys.menu.categories(restaurantId), cats);
  }
}

export function warmModuleData(
  queryClient: QueryClient,
  restaurantId: string,
  href: string,
): void {
  const path = normalizeModuleHref(href);
  if (path.startsWith("/dashboard/mitarbeiter")) {
    seedPriorityModuleQueryCaches(queryClient, restaurantId);
    prefetchCriticalModuleQueries(queryClient, restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/reservierungen")) {
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
  if (path.startsWith("/dashboard/menu")) {
    seedMenuQueryCaches(queryClient, restaurantId);
    void queryClient.prefetchQuery(menuItemsPrefetchOptions(restaurantId));
    void queryClient.prefetchQuery(
      menuMainCategoriesPrefetchOptions(restaurantId),
    );
    void queryClient.prefetchQuery(menuCategoriesPrefetchOptions(restaurantId));
    return;
  }
  if (path.startsWith("/dashboard/inventory")) {
    const ingredients = peekIngredientsCache();
    if (ingredients) {
      queryClient.setQueryData(
        queryKeys.inventory.ingredients(restaurantId),
        ingredients,
      );
    }
    void queryClient.prefetchQuery(
      inventoryIngredientsPrefetchOptions(restaurantId),
    );
    return;
  }
  if (path.startsWith("/dashboard/bewertungen")) {
    void warmReviewsFeed(restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/buchfuehrung")) {
    void warmAccountingInvoices(restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/news")) {
    void warmNewsFeed(restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/events")) {
    void warmEventsFeed(restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/galerie")) {
    void warmGalleryFeed(restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/dokumente")) {
    void warmDocumentsList(restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/checklisten")) {
    void warmStaffTodos(restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/insights")) {
    void warmInsightsOverview(restaurantId);
    return;
  }
  if (path.startsWith("/dashboard/pos")) {
    void warmPosOverview(restaurantId);
  }
  // kontakte/nachrichten: UnifiedInboxBackgroundSyncMount wärmt mit Kanal-Flags.
}

/**
 * Mobile hat kein Hover — Sidebar-Module nach Workspace-Ready datenwarm halten.
 * Gestaffelt, damit kritische Queries (Staff/Reservierungen) zuerst Bandbreite bekommen.
 */
export function warmPriorityModuleDataCaches(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  APP_MODULE_PRIORITY_ROUTES.forEach((href, index) => {
    window.setTimeout(() => {
      warmModuleData(queryClient, restaurantId, href);
    }, index * 45);
  });
}

/** Hover/Focus/Tap: volles Page-Segment + Modul-Daten vor dem Klick wärmen. */
export function warmModuleRouteIntent(
  router: AppRouterInstance,
  queryClient: QueryClient,
  restaurantId: string,
  href: string,
): void {
  // Keep-alive-Slot sync mounten — Soft-Nav Preview ohne RSC-Wartezeit.
  requestModuleHomeWarmForHref(href);
  prefetchAppModuleHref(router, href);
  warmModuleData(queryClient, restaurantId, href);
}
