import type { QueryClient } from "@tanstack/react-query";
import { NEWS_FILTER_ALL } from "@/lib/constants/news-platforms";
import {
  accountingSalesListCacheKey,
  peekAccountingSalesListCache,
} from "@/lib/accounting/accounting-list-client-cache";
import {
  DEFAULT_ACCOUNTING_LIST_SORT_DIR,
  DEFAULT_ACCOUNTING_SALES_DOCUMENT_SORT,
} from "@/lib/accounting/accounting-list-sort";
import { peekUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { peekDocumentsListCache } from "@/lib/documents/documents-list-client-cache";
import { peekEventsFeedCache } from "@/lib/events/events-feed-client-cache";
import { peekGalleryFeedCache } from "@/lib/gallery/gallery-feed-client-cache";
import { peekInsightsOverviewCache } from "@/lib/insights/insights-overview-client-cache";
import { peekIngredientsCache } from "@/lib/inventory/ingredients-query";
import { peekMenuItemsCache } from "@/lib/menu/menu-items-query";
import { peekNewsFeedCache } from "@/lib/news/news-feed-client-cache";
import { peekPosOverviewCache } from "@/lib/pos/pos-overview-client-cache";
import { queryKeys } from "@/lib/query/query-keys";
import {
  currentMonthReservationRange,
  peekReservationsMonthCache,
} from "@/lib/reservations/reservations-month-client-cache";
import { DEFAULT_REVIEWS_FEED_LIST_QUERY_KEY } from "@/lib/reviews/reviews-feed-list-query";
import { peekReviewsFeedSessionCache } from "@/lib/reviews/reviews-feed-session-cache";
import { peekStaffListQueryPlaceholder } from "@/lib/staff/staff-list-query";
import { peekStaffTodosCache } from "@/lib/staff/staff-todos-client-cache";

function normalizePath(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/**
 * Soft-Nav: wenn Modul-Daten schon im Client-Cache liegen, kein Pending-Skeleton.
 * Route-Flight darf weiterlaufen — nur der künstliche „2018-Ladebalken“ entfällt.
 */
export function isModuleSoftNavDataReady(
  href: string,
  restaurantId: string | null | undefined,
  queryClient: QueryClient,
): boolean {
  if (!restaurantId) return false;
  const path = normalizePath(href);

  if (path === "/dashboard") {
    return queryClient
      .getQueriesData({
        queryKey: queryKeys.dashboard.summaryRoot(restaurantId),
      })
      .some(([, data]) => data != null);
  }

  if (path.startsWith("/dashboard/menu")) {
    return (
      queryClient.getQueryData(queryKeys.menu.items(restaurantId)) != null ||
      Boolean(peekMenuItemsCache())
    );
  }

  if (path.startsWith("/dashboard/inventory")) {
    return (
      queryClient.getQueryData(
        queryKeys.inventory.ingredients(restaurantId),
      ) != null || Boolean(peekIngredientsCache())
    );
  }

  if (path.startsWith("/dashboard/mitarbeiter")) {
    return (
      queryClient.getQueryData(queryKeys.staff.list(restaurantId)) != null ||
      Boolean(peekStaffListQueryPlaceholder(restaurantId))
    );
  }

  if (path.startsWith("/dashboard/reservierungen")) {
    const range = currentMonthReservationRange();
    return (
      queryClient.getQueryData(
        queryKeys.reservations.month(
          restaurantId,
          range.rangeStartIso,
          range.rangeEndExclusiveIso,
        ),
      ) != null ||
      Boolean(peekReservationsMonthCache(restaurantId, range)?.rows)
    );
  }

  if (path.startsWith("/dashboard/kontakte")) {
    return Boolean(peekUnifiedInboxCache(restaurantId));
  }

  if (path.startsWith("/dashboard/bewertungen")) {
    return Boolean(
      peekReviewsFeedSessionCache(
        restaurantId,
        DEFAULT_REVIEWS_FEED_LIST_QUERY_KEY,
      )?.feed.ready,
    );
  }

  if (path.startsWith("/dashboard/buchfuehrung")) {
    const key = accountingSalesListCacheKey({
      restaurantId,
      kind: "invoice",
      source: "all",
      status: "all",
      variant: "all",
      search: "",
      page: 1,
      sortKey: DEFAULT_ACCOUNTING_SALES_DOCUMENT_SORT,
      sortDir: DEFAULT_ACCOUNTING_LIST_SORT_DIR,
    });
    return Boolean(peekAccountingSalesListCache(key));
  }

  if (path.startsWith("/dashboard/news")) {
    return Boolean(peekNewsFeedCache(restaurantId, NEWS_FILTER_ALL));
  }

  if (path.startsWith("/dashboard/events")) {
    return Boolean(peekEventsFeedCache(restaurantId));
  }

  if (path.startsWith("/dashboard/galerie")) {
    return Boolean(peekGalleryFeedCache(restaurantId));
  }

  if (path.startsWith("/dashboard/dokumente")) {
    return Boolean(peekDocumentsListCache(restaurantId));
  }

  if (path.startsWith("/dashboard/checklisten")) {
    return Boolean(peekStaffTodosCache(restaurantId));
  }

  if (path.startsWith("/dashboard/insights")) {
    return Boolean(
      peekInsightsOverviewCache(restaurantId, {
        mode: "months",
        value: 3,
      }),
    );
  }

  if (path.startsWith("/dashboard/pos")) {
    return Boolean(peekPosOverviewCache(restaurantId));
  }

  return false;
}
