"use client";

import { usePathname } from "next/navigation";
import { AppReservationsLive } from "@/components/providers/app-reservations-live";
import { AppStaffLive } from "@/components/providers/app-staff-live";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { appZoneFromPath } from "@/lib/navigation/workspace-zone-meta";

/**
 * Realtime einmal pro App-Zone — nicht pro Route ein-/ausblenden.
 *
 * REGRESSION (Live, 2026-06): Route-conditional mount remountete Kanäle bei schneller Soft-Nav
 * → `cannot add postgres_changes callbacks … after subscribe()` → Seite kaputt.
 * Siehe `.cursor/rules/app-realtime-soft-nav.mdc` — Modell nicht ohne ausdrückliche Anfrage ändern.
 */
export function AppModuleLiveProviders() {
  const pathname = usePathname();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const inAppZone = appZoneFromPath(pathname) === "app";

  if (
    !inAppZone ||
    !workspaceReady ||
    !restaurantId ||
    !isUuidRestaurantId(restaurantId)
  ) {
    return null;
  }

  return (
    <>
      <AppReservationsLive />
      <AppStaffLive />
    </>
  );
}
