"use client";

import { Suspense } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { StaffOverviewScreen } from "@/components/staff/staff-overview-screen";
import { StaffOverviewTableSkeleton } from "@/components/staff/staff-overview-skeleton";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const STAFF_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/mitarbeiter/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/mitarbeiter"],
  },
  {
    href: "/dashboard/mitarbeiter/arbeitszeiten",
    label: "Arbeitszeiten",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/schichtplan",
    label: "Schichtplan",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/vertraege",
    label: "Verträge",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/dokumente",
    label: "Dokumente",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/einstellungen",
    label: "Einstellungen",
    matchMode: "prefix",
  },
];

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
          subnavItems={STAFF_NAV}
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
