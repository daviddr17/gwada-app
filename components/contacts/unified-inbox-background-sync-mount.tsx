"use client";

import { useUnifiedInboxBackgroundSync } from "@/lib/contact-messages/unified-inbox-background-sync";
import { useInboxLiveNotifications } from "@/lib/hooks/use-dashboard-live-notifications";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

/** Hintergrund-Sync + Realtime für Unified-Inbox (Wärmen, 5-Min-Polling, WAHA-Webhooks). */
export function UnifiedInboxBackgroundSyncMount({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const {
    loading: connectionsLoading,
    whatsappConnected,
    emailConnected,
  } = useRestaurantChannelConnections(restaurantId);

  const active =
    enabled &&
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  useInboxLiveNotifications();

  useUnifiedInboxBackgroundSync({
    enabled: active,
    restaurantId: active ? restaurantId : null,
    whatsappConnected,
    emailConnected,
    connectionsReady: active && !connectionsLoading,
  });

  return null;
}
