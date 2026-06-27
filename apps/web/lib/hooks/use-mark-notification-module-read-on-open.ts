"use client";

import { useEffect, useRef } from "react";
import { useNotificationSummary } from "@/lib/hooks/use-notification-summary";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";

/** Beim ersten Besuch eines Moduls alle Glocke-Benachrichtigungen dieses Moduls als gelesen markieren. */
export function useMarkNotificationModuleReadOnOpen(
  module: NotificationModuleId,
  enabled = true,
) {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { ready: notificationsReady, markModuleRead } = useNotificationSummary();
  const startedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !workspaceReady || !notificationsReady || !restaurantId) return;
    const key = `${restaurantId}:${module}`;
    if (startedRef.current === key) return;
    startedRef.current = key;
    void markModuleRead({ module });
  }, [
    enabled,
    module,
    markModuleRead,
    notificationsReady,
    restaurantId,
    workspaceReady,
  ]);
}
