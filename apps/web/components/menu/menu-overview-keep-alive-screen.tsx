"use client";

import { Suspense } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { MenuOverviewScreen } from "@/components/menu/menu-overview-screen";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const MENU_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/menu/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/menu"],
  },
  {
    href: "/dashboard/menu/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/menu/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/dashboard/menu/einbinden",
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: "/dashboard/menu/einstellungen",
    label: "Einstellungen",
    matchMode: "exact",
  },
];

/** Keep-alive Host für Speisekarte-Übersicht. */
export function MenuOverviewKeepAliveScreen({
  active,
}: {
  active: boolean;
}) {
  return (
    <>
      {active ? (
        <RegisterModuleChrome
          title="Speisekarte"
          subnavAriaLabel="Speisekarten-Bereiche"
          subnavItems={MENU_NAV}
        />
      ) : null}
      <AppMain>
        <Suspense fallback={null}>
          <MenuOverviewScreen active={active} />
        </Suspense>
      </AppMain>
    </>
  );
}
