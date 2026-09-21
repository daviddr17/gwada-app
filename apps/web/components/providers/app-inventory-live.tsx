"use client";

import { useRestaurantInventoryRealtime } from "@/lib/hooks/use-restaurant-inventory-realtime";
import { useInventoryGlobalQueryInvalidation } from "@/lib/hooks/use-inventory-global-query-invalidation";

/** Eingeloggte App — Bestand/Bestellungen Realtime (Zone-Level). */
export function AppInventoryLive() {
  useRestaurantInventoryRealtime();
  useInventoryGlobalQueryInvalidation();
  return null;
}
