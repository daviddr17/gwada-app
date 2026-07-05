"use client";

import { useRestaurantPermissionsContext } from "@/lib/contexts/restaurant-permissions-context";

/** Liest Berechtigungen aus dem App-weiten Provider (eine Instanz, kein Doppel-Fetch). */
export function useRestaurantPermissions() {
  return useRestaurantPermissionsContext();
}
