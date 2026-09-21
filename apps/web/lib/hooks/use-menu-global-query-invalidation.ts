"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useWindowEventRefresh } from "@/lib/hooks/use-window-event-refresh";
import { GWADA_MENU_DATA_REFRESH_EVENT } from "@/lib/menu/menu-live-events";
import { invalidateMenuQueries } from "@/lib/query/module-query-invalidation";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { menuRelationalPersistenceEnabled } from "@/lib/supabase/menu-db";

/** Invalidiert Speisekarte-Queries — nur refetch, kein Persist. */
export function useMenuGlobalQueryInvalidation() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const useDbMenu = menuRelationalPersistenceEnabled();

  useWindowEventRefresh(
    GWADA_MENU_DATA_REFRESH_EVENT,
    useDbMenu && workspaceReady && Boolean(restaurantId),
    () => {
      if (!restaurantId) return;
      invalidateMenuQueries(queryClient, restaurantId);
    },
  );
}
