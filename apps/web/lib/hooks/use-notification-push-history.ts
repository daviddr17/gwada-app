"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserNotificationPushHistoryRow } from "@/lib/notifications/user-notification-push-history";
import { fetchNotificationPushHistoryClient } from "@/lib/notifications/fetch-notifications-client";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

const PREVIEW_LIMIT = 5;
const HISTORY_DRAWER_LIMIT = 100;

export function useNotificationPushHistory() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [previewRows, setPreviewRows] = useState<UserNotificationPushHistoryRow[]>(
    [],
  );
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const loadGen = useRef(0);

  const ready =
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  const loadPreview = useCallback(async () => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;

    const gen = ++loadGen.current;
    setIsLoading(true);

    const { data, error } = await fetchNotificationPushHistoryClient({
      restaurantId,
      limit: PREVIEW_LIMIT,
      offset: 0,
    });

    if (gen !== loadGen.current) return;

    if (error || !data) {
      setPreviewRows([]);
      setTotalCount(0);
    } else {
      setPreviewRows(data.rows);
      setTotalCount(data.totalCount);
    }
    setIsLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!ready) {
      setIsLoading(false);
      setPreviewRows([]);
      setTotalCount(0);
      return;
    }
    void loadPreview();
  }, [ready, loadPreview]);

  const loadHistory = useCallback(async () => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
      return { rows: [] as UserNotificationPushHistoryRow[], totalCount: 0 };
    }

    const { data, error } = await fetchNotificationPushHistoryClient({
      restaurantId,
      limit: HISTORY_DRAWER_LIMIT,
      offset: 0,
    });

    if (error || !data) {
      return { rows: [], totalCount: 0 };
    }
    return data;
  }, [restaurantId]);

  return {
    ready,
    previewRows,
    totalCount,
    isLoading,
    loadHistory,
    reloadPreview: loadPreview,
    previewLimit: PREVIEW_LIMIT,
  };
}
