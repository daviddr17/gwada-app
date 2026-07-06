"use client";

import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import { fetchIngredientsForRestaurant } from "@/lib/inventory/ingredients-query";
import {
  fetchMenuCategoriesForRestaurant,
  peekMenuCategoriesCache,
} from "@/lib/menu/menu-categories-query";
import {
  fetchMenuMainCategoriesForRestaurant,
  peekMenuMainCategoriesCache,
} from "@/lib/menu/menu-main-categories-query";
import {
  fetchMenuItemsForRestaurant,
  peekMenuItemsCache,
} from "@/lib/menu/menu-items-query";
import {
  NOTIFICATION_SUMMARY_GC_MS,
  NOTIFICATION_SUMMARY_STALE_MS,
} from "@/lib/query/dashboard-query-policy";
import { queryKeys } from "@/lib/query/query-keys";
import { fetchNotificationSummaryClient } from "@/lib/notifications/fetch-notifications-client";
import { notificationSummaryWithMessagesFromConversations } from "@/lib/notifications/patch-notification-messages-from-inbox-cache";
import { peekUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { peekDocumentsListCache } from "@/lib/documents/documents-list-client-cache";
import { peekEventsFeedCache } from "@/lib/events/events-feed-client-cache";
import { peekGalleryFeedCache } from "@/lib/gallery/gallery-feed-client-cache";
import { peekNewsFeedCache } from "@/lib/news/news-feed-client-cache";
import {
  currentMonthReservationRange,
  peekReservationsMonthCache,
} from "@/lib/reservations/reservations-month-client-cache";
import { NEWS_FILTER_ALL } from "@/lib/constants/news-platforms";
import { peekStaffListCache } from "@/lib/staff/staff-list-client-cache";
import { peekStaffTodosCache } from "@/lib/staff/staff-todos-client-cache";
import type { QueryClient } from "@tanstack/react-query";

export function menuItemsPrefetchOptions(restaurantId: string) {
  return {
    queryKey: queryKeys.menu.items(restaurantId),
    queryFn: fetchMenuItemsForRestaurant,
    staleTime: getModuleCacheStaleTime("menuModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("menuModule") ?? 5 * 60_000,
  };
}

export function menuMainCategoriesPrefetchOptions(restaurantId: string) {
  return {
    queryKey: queryKeys.menu.mainCategories(restaurantId),
    queryFn: fetchMenuMainCategoriesForRestaurant,
    staleTime: getModuleCacheStaleTime("menuModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("menuModule") ?? 5 * 60_000,
  };
}

export function menuCategoriesPrefetchOptions(restaurantId: string) {
  return {
    queryKey: queryKeys.menu.categories(restaurantId),
    queryFn: fetchMenuCategoriesForRestaurant,
    staleTime: getModuleCacheStaleTime("menuModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("menuModule") ?? 5 * 60_000,
  };
}

export function inventoryIngredientsPrefetchOptions(restaurantId: string) {
  return {
    queryKey: queryKeys.inventory.ingredients(restaurantId),
    queryFn: fetchIngredientsForRestaurant,
    staleTime: getModuleCacheStaleTime("inventoryModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("inventoryModule") ?? 5 * 60_000,
  };
}

export function notificationSummaryPrefetchOptions(restaurantId: string) {
  return {
    queryKey: queryKeys.notifications.summary(restaurantId),
    queryFn: async () => {
      const { data, error } = await fetchNotificationSummaryClient(restaurantId);
      if (!data) throw new Error(error ?? "notification_summary_failed");
      const conversations = peekUnifiedInboxCache(restaurantId);
      if (!conversations) return data;
      return notificationSummaryWithMessagesFromConversations(data, conversations);
    },
    staleTime: NOTIFICATION_SUMMARY_STALE_MS,
    gcTime: NOTIFICATION_SUMMARY_GC_MS,
  };
}

/** React-Query-Caches für häufige Module — nach Workspace-Ready im Idle. */
export function prefetchAppModuleQueryCaches(
  queryClient: QueryClient,
  restaurantId: string,
): void {
  void queryClient.prefetchQuery(menuItemsPrefetchOptions(restaurantId));
  void queryClient.prefetchQuery(menuMainCategoriesPrefetchOptions(restaurantId));
  void queryClient.prefetchQuery(menuCategoriesPrefetchOptions(restaurantId));
  void queryClient.prefetchQuery(inventoryIngredientsPrefetchOptions(restaurantId));
  void queryClient.prefetchQuery(notificationSummaryPrefetchOptions(restaurantId));
}

export function peekAppModuleWarmCachesReady(restaurantId: string): boolean {
  const monthRange = currentMonthReservationRange();
  return Boolean(
    peekMenuItemsCache()?.length ||
      peekMenuMainCategoriesCache()?.length ||
      peekMenuCategoriesCache()?.length ||
      peekUnifiedInboxCache(restaurantId)?.length ||
      peekEventsFeedCache(restaurantId)?.items.length ||
      peekNewsFeedCache(restaurantId, NEWS_FILTER_ALL)?.items.length ||
      peekGalleryFeedCache(restaurantId)?.items.length ||
      peekStaffListCache(restaurantId)?.rows.length ||
      peekReservationsMonthCache(restaurantId, monthRange)?.rows.length ||
      peekDocumentsListCache(restaurantId)?.rows.length ||
      peekStaffTodosCache(restaurantId)?.todos.length,
  );
}
