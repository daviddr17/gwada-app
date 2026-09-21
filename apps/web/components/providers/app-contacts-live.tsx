"use client";

import { useRestaurantContactsRealtime } from "@/lib/hooks/use-restaurant-contacts-realtime";

/** Zone-Level Kontakte-Realtime. */
export function AppContactsLive() {
  useRestaurantContactsRealtime();
  return null;
}
