"use client";

import { Suspense } from "react";
import { InventoryScreen } from "@/components/inventory/inventory-screen";
import { InventoryVoiceFabRoute } from "@/components/inventory/inventory-voice-fab-route";
import { INVENTORY_MODULE_NAV } from "@/components/inventory/inventory-module-nav";
import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

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
          subnavItems={INVENTORY_MODULE_NAV}
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
