"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { backfillLiveActivityFeed } from "@/lib/live-activity/live-activity-backfill";
import {
  clearLiveActivityFeed,
  clearLiveActivitySeenDot,
  ensureLiveActivityRestaurant,
  getLiveActivityItems,
  liveActivityHasUnseen,
  subscribeLiveActivity,
} from "@/lib/live-activity/live-activity-store";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function useLiveActivityFeed(): {
  items: LiveActivityItem[];
  hasUnseen: boolean;
  markSeen: () => void;
  clear: () => void;
  restaurantId: string | null;
} {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const timeZone = useRestaurantIanaTimezone(restaurantId);
  const dayKey = restaurantTodayYmd(timeZone);

  useEffect(() => {
    if (!restaurantId) return;
    ensureLiveActivityRestaurant(restaurantId, dayKey);
    void backfillLiveActivityFeed(restaurantId, dayKey);
  }, [restaurantId, dayKey]);

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
