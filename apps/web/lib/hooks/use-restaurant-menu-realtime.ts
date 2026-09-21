"use client";

import { dispatchMenuDataRefresh } from "@/lib/menu/menu-live-events";
import { useRestaurantTablesLiveRefresh } from "@/lib/hooks/use-restaurant-tables-live-refresh";

export function useRestaurantMenuRealtime() {
  useRestaurantTablesLiveRefresh({
    tables: ["menu_items", "menu_categories", "menu_main_categories"],
    channelPrefix: "menu-live",
    onRefresh: dispatchMenuDataRefresh,
  });
}
