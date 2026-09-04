"use client";

import { useRestaurantDiningRealtime } from "@/lib/hooks/use-restaurant-dining-realtime";

/** Zone-Level Tischplan-Realtime. */
export function AppDiningLive() {
  useRestaurantDiningRealtime();
  return null;
}
