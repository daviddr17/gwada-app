"use client";

import { Suspense } from "react";
import { AppMain } from "@/components/layout/app-main";
import { STAFF_MODULE_NAV } from "@/components/staff/staff-module-nav";
import { StaffOverviewScreen } from "@/components/staff/staff-overview-screen";
import { StaffOverviewTableSkeleton } from "@/components/staff/staff-overview-skeleton";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

/** Keep-alive Host für Mitarbeiter-Übersicht. */
export function StaffOverviewKeepAliveScreen({
  active,
  showChrome = active,
}: {
  active: boolean;
  showChrome?: boolean;
}) {
  return (
    <>
      {showChrome ? (
        <RegisterModuleChrome
          title="Mitarbeiter"
          subnavAriaLabel="Mitarbeiter-Bereiche"
          subnavItems={STAFF_MODULE_NAV}
        />
      ) : null}
      <AppMain>
        <Suspense fallback={<StaffOverviewTableSkeleton />}>
          <StaffOverviewScreen active={active} />
        </Suspense>
      </AppMain>
    </>
  );
}
