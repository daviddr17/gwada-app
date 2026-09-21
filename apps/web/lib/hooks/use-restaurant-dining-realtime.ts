"use client";

import { dispatchDiningDataRefresh } from "@/lib/reservations/dining-live-events";
import { useRestaurantTablesLiveRefresh } from "@/lib/hooks/use-restaurant-tables-live-refresh";

export function useRestaurantDiningRealtime() {
  useRestaurantTablesLiveRefresh({
    tables: ["dining_tables", "dining_areas"],
    channelPrefix: "dining-live",
    onRefresh: dispatchDiningDataRefresh,
  });
}
