"use client";

import { usePathname } from "next/navigation";
import { AppReservationsLive } from "@/components/providers/app-reservations-live";
import { AppStaffLive } from "@/components/providers/app-staff-live";

function needsReservationsLive(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/reservierungen")
  );
}

function needsStaffLive(pathname: string): boolean {
  return (
    pathname === "/dashboard" || pathname.startsWith("/dashboard/mitarbeiter")
  );
}

/** Realtime nur auf Routen, die Reservierungs-/Mitarbeiter-Live brauchen. */
export function AppModuleLiveProviders() {
  const pathname = usePathname();
  const reservations = needsReservationsLive(pathname);
  const staff = needsStaffLive(pathname);

  return (
    <>
      {reservations ? <AppReservationsLive /> : null}
      {staff ? <AppStaffLive /> : null}
    </>
  );
}
