"use client";

import { Suspense, useMemo } from "react";
import { AppMain } from "@/components/layout/app-main";
import { ReservationVoiceFab } from "@/components/reservations/reservation-voice-fab";
import { ReservationsOverview } from "@/components/reservations/reservations-overview";
import { RESERVATIONS_MODULE_NAV } from "@/components/reservations/reservations-module-nav";
import { ReservationsChromeActions } from "@/components/ops/module-chrome-quick-actions";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

/** Keep-alive Host für Reservierungen-Übersicht (Chrome + FAB nur wenn active). */
export function ReservationsOverviewKeepAliveScreen({
  active,
  showChrome = active,
}: {
  active: boolean;
  showChrome?: boolean;
}) {
  // Stabil — sonst RegisterModuleChrome-Effect-Loop (headerActions Identity).
  const headerActions = useMemo(() => <ReservationsChromeActions />, []);

  return (
    <>
      {showChrome ? (
        <RegisterModuleChrome
          title="Reservierungen"
          subnavAriaLabel="Reservierungs-Bereiche"
          subnavItems={RESERVATIONS_MODULE_NAV}
          headerActions={headerActions}
        />
      ) : null}
      <AppMain>
        <Suspense fallback={null}>
          <ReservationsOverview active={active} />
        </Suspense>
      </AppMain>
      {active ? <ReservationVoiceFab /> : null}
    </>
  );
}
