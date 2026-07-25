"use client";

import { NEWS_FILTER_ALL } from "@/lib/constants/news-platforms";
import {
  accountingSalesListCacheKey,
  peekAccountingSalesListCache,
  writeAccountingSalesListCache,
} from "@/lib/accounting/accounting-list-client-cache";
import {
  DEFAULT_ACCOUNTING_LIST_SORT_DIR,
  DEFAULT_ACCOUNTING_SALES_DOCUMENT_SORT,
} from "@/lib/accounting/accounting-list-sort";
import {
  fetchAccountingCatalog,
  fetchAccountingDocumentStatuses,
  fetchAccountingInvoices,
} from "@/lib/accounting/accounting-api";
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
import {
  isNewsFeedClientCacheFresh,
  writeNewsFeedCache,
} from "@/lib/news/news-feed-client-cache";
import type { NewsFeedSyncMeta } from "@/lib/news/news-feed-sync-meta";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import {
  fetchDocumentsForRestaurant,
  fetchDocumentsStorageUsage,
} from "@/lib/supabase/documents-db";
import { fetchStaffTodosForRestaurant } from "@/lib/supabase/staff-todos-db";
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
import {
  createEmptyReviewsFeedClientCache,
  type ReviewsFeedClientCache,
} from "@/lib/reviews/reviews-feed-client-cache";
import { DEFAULT_REVIEWS_FEED_LIST_QUERY_KEY } from "@/lib/reviews/reviews-feed-list-query";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import type { MergedReviewsPaginationMeta } from "@/lib/reviews/reviews-list-pagination";
import {
  peekReviewsFeedSessionCache,
  writeReviewsFeedSessionCache,
} from "@/lib/reviews/reviews-feed-session-cache";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
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

/** Default Bewertungs-Feed (platform=all, Seite 1) — Soft-Nav ohne Skeleton. */
export async function warmReviewsFeed(restaurantId: string): Promise<void> {
  if (
    peekReviewsFeedSessionCache(
      restaurantId,
      DEFAULT_REVIEWS_FEED_LIST_QUERY_KEY,
      FEED_STALE_MS,
    )?.feed.ready
  ) {
    return;
  }

  try {
    const res = await fetch(
      `/api/reviews?${new URLSearchParams({ restaurantId, platform: "all" })}`,
    );
    const json = (await res.json()) as {
      reviews?: UnifiedReview[];
      mergedPagination?: MergedReviewsPaginationMeta | null;
      platformTotals?: ReviewsFeedClientCache["platformTotals"];
      loadErrors?: ReviewsFeedClientCache["loadErrors"];
      sync?: ReviewsFeedSyncMeta | null;
      error?: string;
    };
    if (!res.ok) return;
    const reviews = (json.reviews ?? []).map((review) => ({
      ...review,
      isUnread: false,
    }));
    const nextToken = json.mergedPagination?.nextPageToken;
    const feed: ReviewsFeedClientCache = {
      ...createEmptyReviewsFeedClientCache(),
      ready: true,
      allPages: { 1: reviews },
      allPagination: json.mergedPagination ?? null,
      allTokenByPage:
        typeof nextToken === "string" && nextToken.length > 0
          ? { 1: nextToken }
          : {},
      platformTotals:
        json.platformTotals ?? json.mergedPagination?.platformTotals ?? {},
      loadErrors: json.loadErrors ?? {},
      sync: json.sync ?? null,
    };
    writeReviewsFeedSessionCache(
      restaurantId,
      {
        feed,
        googleLocationSummary: null,
        googleStatsError: null,
      },
      DEFAULT_REVIEWS_FEED_LIST_QUERY_KEY,
    );
  } catch {
    /* background warm */
  }
}

/** Default Rechnungen-Liste (Seite 1) — Soft-Nav ohne Skeleton. */
export async function warmAccountingInvoices(
  restaurantId: string,
): Promise<void> {
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
  if (peekAccountingSalesListCache(key)) return;

  try {
    const [list, catalog, statusRows] = await Promise.all([
      fetchAccountingInvoices(restaurantId, { page: 1 }),
      fetchAccountingCatalog(restaurantId),
      fetchAccountingDocumentStatuses(restaurantId, "invoice", {
        includeArchived: true,
      }),
    ]);
    writeAccountingSalesListCache(key, {
      rows: list.items,
      listMeta: {
        page: list.page,
        totalPages: list.totalPages,
        totalCount: list.totalCount,
      },
      catalog: {
        taxRates: catalog.taxRates,
        units: catalog.units,
        articles: catalog.articles,
      },
      statuses: statusRows,
    });
  } catch {
    /* background warm */
  }
}

/** Feeds, Dokumente, Todos, Insights, POS, Reviews, Buchhaltung. */
export function warmAppModuleSecondaryCaches(
  _queryClient: QueryClient,
  restaurantId: string,
): void {
  void warmEventsFeed(restaurantId);
  void warmNewsFeed(restaurantId);
  void warmGalleryFeed(restaurantId);
  void warmDocumentsList(restaurantId);
  void warmStaffTodos(restaurantId);
  void warmInsightsOverview(restaurantId);
  void warmPosOverview(restaurantId);
  void warmReviewsFeed(restaurantId);
  void warmAccountingInvoices(restaurantId);
}
