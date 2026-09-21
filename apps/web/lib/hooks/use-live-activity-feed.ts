"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  backfillLiveActivityFeed,
  fetchLiveActivityFeedPage,
} from "@/lib/live-activity/live-activity-fetch-client";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import {
  clearLiveActivitySeenDot,
  ensureLiveActivityRestaurant,
  getLiveActivityItems,
  liveActivityHasUnseen,
  mergeLiveActivityItems,
  subscribeLiveActivity,
} from "@/lib/live-activity/live-activity-store";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useLiveActivityFeed(): {
  items: LiveActivityItem[];
  hasUnseen: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  markSeen: () => void;
  loadMore: () => Promise<void>;
  restaurantId: string | null;
} {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);

  useEffect(() => {
    if (!restaurantId) return;
    ensureLiveActivityRestaurant(restaurantId);
    setNextOffset(0);
    setHasMore(false);
    void (async () => {
      const page = await backfillLiveActivityFeed(restaurantId);
      if (!page) return;
      setHasMore(page.hasMore);
      setNextOffset(page.items.length);
    })();
  }, [restaurantId]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeLiveActivity(onStoreChange),
    [],
  );

  const items = useSyncExternalStore(
    subscribe,
    getLiveActivityItems,
    () => [] as LiveActivityItem[],
  );

  const hasUnseenSnapshot = useCallback(() => {
    if (!restaurantId) return false;
    return liveActivityHasUnseen(restaurantId);
  }, [restaurantId]);

  const hasUnseen = useSyncExternalStore(
    subscribe,
    hasUnseenSnapshot,
    () => false,
  );

  const markSeen = useCallback(() => {
    if (restaurantId) clearLiveActivitySeenDot(restaurantId);
  }, [restaurantId]);

  const loadMore = useCallback(async () => {
    if (!restaurantId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchLiveActivityFeedPage(restaurantId, {
        offset: nextOffset,
      });
      if (!page) return;
      if (page.items.length) {
        mergeLiveActivityItems(restaurantId, page.items);
        setNextOffset((prev) => prev + page.items.length);
      }
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [restaurantId, loadingMore, hasMore, nextOffset]);

  return {
    items,
    hasUnseen,
    hasMore,
    loadingMore,
    markSeen,
    loadMore,
    restaurantId,
  };
}
