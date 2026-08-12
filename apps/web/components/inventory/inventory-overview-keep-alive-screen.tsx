"use client";

import { Suspense } from "react";
import { InventoryScreen } from "@/components/inventory/inventory-screen";
import { InventoryVoiceFabRoute } from "@/components/inventory/inventory-voice-fab-route";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const INVENTORY_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/inventory/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/inventory"],
  },
  {
    href: "/dashboard/inventory/bestellung",
    label: "Bestellung",
    matchMode: "prefix",
    activeWhen: ["/dashboard/inventory/bestellung"],
  },
  {
    href: "/dashboard/inventory/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
];

/** Keep-alive Host für Bestand-Übersicht. */
export function InventoryOverviewKeepAliveScreen({
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
          title="Bestand"
          subnavAriaLabel="Bestand-Bereiche"
          subnavItems={INVENTORY_NAV}
        />
      ) : null}
      <AppMain>
        <Suspense fallback={null}>
          <InventoryScreen active={active} />
        </Suspense>
      </AppMain>
      {active ? <InventoryVoiceFabRoute /> : null}
    </>
  );
}
