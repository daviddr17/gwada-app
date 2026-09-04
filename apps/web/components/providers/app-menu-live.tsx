"use client";

import { useRestaurantMenuRealtime } from "@/lib/hooks/use-restaurant-menu-realtime";
import { useMenuGlobalQueryInvalidation } from "@/lib/hooks/use-menu-global-query-invalidation";

/** Zone-Level Speisekarte-Realtime. */
export function AppMenuLive() {
  useRestaurantMenuRealtime();
  useMenuGlobalQueryInvalidation();
  return null;
}
