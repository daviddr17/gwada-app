"use client";

import { NEWS_FILTER_ALL } from "@/lib/constants/news-platforms";
import {
  isDocumentsListCacheFresh,
  writeDocumentsListCache,
} from "@/lib/documents/documents-list-client-cache";
import type { EventsFeedSyncMeta } from "@/lib/events/events-feed-sync-meta";
import {
  peekEventsFeedCache,
  writeEventsFeedCache,
} from "@/lib/events/events-feed-client-cache";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import {
  isGalleryFeedClientCacheFresh,
  writeGalleryFeedCache,
} from "@/lib/gallery/gallery-feed-client-cache";
import type { GalleryFeedSyncMeta } from "@/lib/gallery/gallery-feed-sync-meta";
import type {
  GalleryCategoryOption,
  UnifiedGalleryHighlight,
  UnifiedGalleryItem,
} from "@/lib/gallery/unified-gallery-item";
import { prefetchAppModuleQueryCaches } from "@/lib/hooks/app-module-query-prefetch";
import {
  isNewsFeedClientCacheFresh,
  writeNewsFeedCache,
} from "@/lib/news/news-feed-client-cache";
import type { NewsFeedSyncMeta } from "@/lib/news/news-feed-sync-meta";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import {
  currentMonthReservationRange,
  isReservationsMonthCacheFresh,
  writeReservationsMonthCache,
} from "@/lib/reservations/reservations-month-client-cache";
import {
  fetchDocumentsForRestaurant,
  fetchDocumentsStorageUsage,
} from "@/lib/supabase/documents-db";
import {
  fetchReservationsForRestaurant,
} from "@/lib/supabase/reservations-db";
import {
  fetchStaffContractsForRestaurant,
  fetchStaffForRestaurant,
} from "@/lib/supabase/staff-db";
import { fetchStaffTodosForRestaurant } from "@/lib/supabase/staff-todos-db";
import {
  isStaffListCacheFresh,
  writeStaffListCache,
} from "@/lib/staff/staff-list-client-cache";
import {
  isStaffTodosCacheFresh,
  writeStaffTodosCache,
} from "@/lib/staff/staff-todos-client-cache";
import {
  isInsightsOverviewCacheFresh,
  writeInsightsOverviewCache,
} from "@/lib/insights/insights-overview-client-cache";
import type { InsightsStatisticsResult } from "@/lib/insights/compute-insights-statistics";
import {
  isPosOverviewCacheFresh,
  writePosOverviewCache,
} from "@/lib/pos/pos-overview-client-cache";
import {
  fetchPosActiveOrders,
  fetchPosPaidTodayOrders,
  fetchPosRegisterStatus,
} from "@/lib/pos/pos-web-api-client";
import type { QueryClient } from "@tanstack/react-query";

const FEED_STALE_MS = 5 * 60_000;

export async function warmEventsFeed(restaurantId: string): Promise<void> {
  const cached = peekEventsFeedCache(restaurantId);
  if (cached && Date.now() - cached.at <= FEED_STALE_MS) return;

  try {
    const res = await fetch(
      `/api/events?${new URLSearchParams({ restaurantId })}`,
    );
    const data = (await res.json()) as {
      items?: UnifiedEventItem[];
      sync?: EventsFeedSyncMeta;
    };
    if (!res.ok) return;
    writeEventsFeedCache(restaurantId, {
      items: data.items ?? [],
      sync: data.sync ?? null,
    });
  } catch {
    /* background warm */
  }
}

export async function warmNewsFeed(restaurantId: string): Promise<void> {
  if (isNewsFeedClientCacheFresh(restaurantId, NEWS_FILTER_ALL, FEED_STALE_MS)) {
    return;
  }

  try {
    const res = await fetch(
      `/api/news?${new URLSearchParams({ restaurantId })}`,
    );
    const data = (await res.json()) as {
      items?: UnifiedNewsItem[];
      sync?: NewsFeedSyncMeta;
    };
    if (!res.ok) return;
    writeNewsFeedCache(
      restaurantId,
      NEWS_FILTER_ALL,
      data.items ?? [],
      data.sync ?? null,
    );
  } catch {
    /* background warm */
  }
}

export async function warmGalleryFeed(restaurantId: string): Promise<void> {
  if (isGalleryFeedClientCacheFresh(restaurantId, FEED_STALE_MS)) return;

  try {
    const res = await fetch(
      `/api/gallery?${new URLSearchParams({ restaurantId })}`,
    );
    const data = (await res.json()) as {
      items?: UnifiedGalleryItem[];
      highlights?: UnifiedGalleryHighlight[];
      categories?: GalleryCategoryOption[];
      sync?: GalleryFeedSyncMeta;
    };
    if (!res.ok) return;
    writeGalleryFeedCache(restaurantId, {
      items: data.items ?? [],
      highlights: data.highlights ?? [],
      categories: data.categories ?? [],
      sync: data.sync ?? null,
    });
  } catch {
    /* background warm */
  }
}

async function warmStaffList(restaurantId: string): Promise<void> {
  if (isStaffListCacheFresh(restaurantId, FEED_STALE_MS)) return;

  const [staffRes, contractsRes] = await Promise.all([
    fetchStaffForRestaurant(restaurantId),
    fetchStaffContractsForRestaurant(restaurantId),
  ]);
  if (staffRes.error && contractsRes.error) return;
  writeStaffListCache(restaurantId, {
    rows: staffRes.data,
    contracts: contractsRes.data,
  });
}

async function warmReservationsCurrentMonth(restaurantId: string): Promise<void> {
  const range = currentMonthReservationRange();
  if (isReservationsMonthCacheFresh(restaurantId, range, FEED_STALE_MS)) return;

  const { data, error } = await fetchReservationsForRestaurant({
    restaurantId,
    rangeStartIso: range.rangeStartIso,
    rangeEndExclusiveIso: range.rangeEndExclusiveIso,
  });
  if (error) return;
  writeReservationsMonthCache(restaurantId, range, data);
}

export async function warmDocumentsList(restaurantId: string): Promise<void> {
  if (isDocumentsListCacheFresh(restaurantId, FEED_STALE_MS)) return;

  const [docs, storage] = await Promise.all([
    fetchDocumentsForRestaurant(restaurantId),
    fetchDocumentsStorageUsage(restaurantId),
  ]);
  if (docs.error && storage.error) return;
  writeDocumentsListCache(restaurantId, {
    rows: docs.data,
    usage: storage.data,
  });
}

export async function warmStaffTodos(restaurantId: string): Promise<void> {
  if (isStaffTodosCacheFresh(restaurantId, FEED_STALE_MS)) return;

  const todoRes = await fetchStaffTodosForRestaurant(restaurantId);
  if (todoRes.error) return;
  writeStaffTodosCache(restaurantId, {
    todos: todoRes.data,
    restaurantTimezone: todoRes.restaurantTimezone,
  });
}

const DEFAULT_INSIGHTS_PERIOD = { mode: "months" as const, value: 3 as const };

export async function warmInsightsOverview(restaurantId: string): Promise<void> {
  if (
    isInsightsOverviewCacheFresh(
      restaurantId,
      DEFAULT_INSIGHTS_PERIOD,
      FEED_STALE_MS,
    )
  ) {
    return;
  }

  try {
    const params = new URLSearchParams({
      restaurantId,
      monthsBack: String(DEFAULT_INSIGHTS_PERIOD.value),
    });
    const res = await fetch(`/api/insights/statistics?${params}`);
    const body = (await res.json()) as InsightsStatisticsResult & {
      error?: string;
    };
    if (!res.ok) return;
    writeInsightsOverviewCache(restaurantId, DEFAULT_INSIGHTS_PERIOD, body);
  } catch {
    /* background warm */
  }
}

export async function warmPosOverview(restaurantId: string): Promise<void> {
  if (isPosOverviewCacheFresh(restaurantId, FEED_STALE_MS)) return;

  try {
    const [active, paid, register] = await Promise.all([
      fetchPosActiveOrders(restaurantId),
      fetchPosPaidTodayOrders(restaurantId),
      fetchPosRegisterStatus(restaurantId),
    ]);
    writePosOverviewCache(restaurantId, {
      activeCount: active.ok ? active.data.orders.length : null,
      paidTodayCents: paid.ok
        ? paid.data.orders.reduce(
            (sum, o) => sum + o.totalCents + o.tipCents,
            0,
          )
        : null,
      registerOpen: register.ok ? register.data.isOpen : null,
    });
  } catch {
    /* background warm */
  }
}

/** React-Query + Modul-Caches — Mitarbeiter/Reservierungen in prefetchCriticalModuleQueries. */
export function warmAppModulePriorityCaches(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  prefetchAppModuleQueryCaches(queryClient, restaurantId);
}

/** Feeds, Dokumente, Todos — nach den kritischen Modulen. */
export function warmAppModuleSecondaryCaches(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  void warmEventsFeed(restaurantId);
  void warmNewsFeed(restaurantId);
  void warmGalleryFeed(restaurantId);
  void warmStaffList(restaurantId);
  void warmReservationsCurrentMonth(restaurantId);
  void warmDocumentsList(restaurantId);
  void warmStaffTodos(restaurantId);
  void warmInsightsOverview(restaurantId);
  void warmPosOverview(restaurantId);
}

export function warmAppModuleCaches(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  warmAppModulePriorityCaches(queryClient, restaurantId);
  warmAppModuleSecondaryCaches(queryClient, restaurantId);
}
