"use client";

import { useRestaurantStaffRealtime } from "@/lib/hooks/use-restaurant-staff-realtime";

/** Eingeloggte App — Mitarbeiter-Realtime (kein Polling). */
export function AppStaffLive() {
  useRestaurantStaffRealtime();
  return null;
}
