"use client";

import { usePlatformReservationsLive } from "@/lib/hooks/use-platform-reservations-live";

/** Eingeloggte Plattform-App — Reservierungs-Live (nicht Landing/Login/Display). */
export function AppReservationsLive() {
  usePlatformReservationsLive();
  return null;
}
