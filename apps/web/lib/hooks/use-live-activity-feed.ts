"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  clearLiveActivityFeed,
  clearLiveActivitySeenDot,
  ensureLiveActivityRestaurant,
  getLiveActivityItems,
  liveActivityHasUnseen,
  subscribeLiveActivity,
} from "@/lib/live-activity/live-activity-store";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useLiveActivityFeed(): {
  items: LiveActivityItem[];
  hasUnseen: boolean;
  markSeen: () => void;
  clear: () => void;
  restaurantId: string | null;
} {
  const { restaurantId } = useWorkspaceRestaurantUuid();

  useEffect(() => {
    if (restaurantId) ensureLiveActivityRestaurant(restaurantId);
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

  const clear = useCallback(() => {
    if (restaurantId) clearLiveActivityFeed(restaurantId);
  }, [restaurantId]);

  return { items, hasUnseen, markSeen, clear, restaurantId };
}
