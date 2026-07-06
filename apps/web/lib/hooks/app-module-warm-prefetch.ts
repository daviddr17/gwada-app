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
  isReviewsFeedSessionCacheFresh,
  writeReviewsFeedSessionCache,
} from "@/lib/reviews/reviews-feed-client-cache";
import type { ReviewsFeedSyncMeta } from "@/lib/reviews/reviews-feed-sync-meta";
import type { MergedReviewsPaginationMeta } from "@/lib/reviews/reviews-list-pagination";
import {
  isReviewPlatformConnectionsCacheFresh,
  writeReviewPlatformConnectionsCache,
} from "@/lib/reviews/review-platform-connections-cache";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
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
import type { QueryClient } from "@tanstack/react-query";

const FEED_STALE_MS = 5 * 60_000;

async function warmEventsFeed(restaurantId: string): Promise<void> {
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

async function warmNewsFeed(restaurantId: string): Promise<void> {
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

async function warmGalleryFeed(restaurantId: string): Promise<void> {
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

async function warmDocumentsList(restaurantId: string): Promise<void> {
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

async function warmStaffTodos(restaurantId: string): Promise<void> {
  if (isStaffTodosCacheFresh(restaurantId, FEED_STALE_MS)) return;

  const todoRes = await fetchStaffTodosForRestaurant(restaurantId);
  if (todoRes.error) return;
  writeStaffTodosCache(restaurantId, {
    todos: todoRes.data,
    restaurantTimezone: todoRes.restaurantTimezone,
  });
}

async function warmReviewPlatformConnections(restaurantId: string): Promise<void> {
  if (isReviewPlatformConnectionsCacheFresh(restaurantId, FEED_STALE_MS)) return;

  try {
    const res = await fetch(
      `/api/reviews/channels-status?${new URLSearchParams({ restaurantId })}`,
    );
    const body = (await res.json()) as {
      googleConnected?: boolean;
      facebookConnected?: boolean;
      googleVisible?: boolean;
      facebookVisible?: boolean;
    };
    if (!res.ok) return;
    writeReviewPlatformConnectionsCache(restaurantId, {
      googleConnected: Boolean(body.googleConnected),
      facebookConnected: Boolean(body.facebookConnected),
      googleVisible: Boolean(body.googleVisible),
      facebookVisible: Boolean(body.facebookVisible),
    });
  } catch {
    /* background warm */
  }
}

async function warmReviewsFeed(restaurantId: string): Promise<void> {
  if (isReviewsFeedSessionCacheFresh(restaurantId, FEED_STALE_MS)) return;

  try {
    const res = await fetch(
      `/api/reviews?${new URLSearchParams({ restaurantId, platform: "all" })}`,
    );
    const json = (await res.json()) as {
      reviews?: UnifiedReview[];
      mergedPagination?: MergedReviewsPaginationMeta;
      platformTotals?: Partial<Record<string, number>>;
      loadErrors?: Partial<Record<string, string>>;
      sync?: ReviewsFeedSyncMeta;
    };
    if (!res.ok || !json.reviews) return;

    const reviews = json.reviews.map((review) => ({
      ...review,
      isUnread: false,
    }));
    const gwada = reviews.filter((review) => review.platform === "gwada");

    writeReviewsFeedSessionCache(
      restaurantId,
      {
        ready: true,
        gwada,
        allPages: { 1: reviews },
        allPagination: json.mergedPagination ?? null,
        allTokenByPage: json.mergedPagination?.nextPageToken
          ? { 2: json.mergedPagination.nextPageToken }
          : {},
        googlePages: {},
        googlePagination: null,
        googleTokenByPage: {},
        facebookPages: {},
        facebookPagination: null,
        facebookTokenByPage: {},
        platformTotals:
          json.platformTotals ?? json.mergedPagination?.platformTotals ?? {},
        loadErrors: json.loadErrors ?? {},
        sync: json.sync ?? null,
      },
      null,
    );
  } catch {
    /* background warm */
  }
}

/**
 * React-Query + Modul-Caches im Idle wärmen — Sidebar-Wechsel ohne Skeleton.
 */
export function warmAppModuleCaches(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  prefetchAppModuleQueryCaches(queryClient, restaurantId);

  void warmEventsFeed(restaurantId);
  void warmNewsFeed(restaurantId);
  void warmGalleryFeed(restaurantId);
  void warmStaffList(restaurantId);
  void warmReservationsCurrentMonth(restaurantId);
  void warmDocumentsList(restaurantId);
  void warmStaffTodos(restaurantId);
  void warmReviewPlatformConnections(restaurantId);
  void warmReviewsFeed(restaurantId);
}
