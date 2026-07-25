"use client";

import { usePathname } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import { ReservationVoiceFab } from "@/components/reservations/reservation-voice-fab";
import { RESERVATIONS_MODULE_NAV } from "@/components/reservations/reservations-module-nav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { isModuleHomePath } from "@/lib/navigation/module-home-keep-alive";

export default function ReservierungenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  // Übersicht: Keep-alive unter App-Shell besitzt Chrome + Inhalt.
  if (isModuleHomePath(pathname, "reservierungen")) {
    return null;
  }

  return (
    <>
      <RegisterModuleChrome
        title="Reservierungen"
        subnavAriaLabel="Reservierungs-Bereiche"
        subnavItems={RESERVATIONS_MODULE_NAV}
      />
      <AppMain>{children}</AppMain>
      <ReservationVoiceFab />
    </>
  );
}
