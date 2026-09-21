"use client";

import { peekUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { useUnifiedInboxBackgroundSync } from "@/lib/contact-messages/unified-inbox-background-sync";
import { useInboxLiveNotifications } from "@/lib/hooks/use-dashboard-live-notifications";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

/** Hintergrund-Sync + Realtime für Unified-Inbox (Wärmen, 5-Min-Polling, WAHA-Webhooks). */
export function UnifiedInboxBackgroundSyncMount({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();

  const active =
    enabled &&
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  useInboxLiveNotifications({ enabled: active });

  useUnifiedInboxBackgroundSync({
    enabled: active,
    restaurantId: active ? restaurantId : null,
  });

  return null;
}
