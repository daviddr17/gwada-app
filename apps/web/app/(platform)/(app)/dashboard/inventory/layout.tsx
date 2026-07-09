"use client";

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

export default function InventoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Bestand"
        subnavAriaLabel="Bestand-Bereiche"
        subnavItems={INVENTORY_NAV}
      />
      <AppMain>{children}</AppMain>
      <InventoryVoiceFabRoute />
    </>
  );
}
