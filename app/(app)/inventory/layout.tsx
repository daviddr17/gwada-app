"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const INVENTORY_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/inventory",
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: "/inventory/bestellung",
    label: "Bestellung",
    matchMode: "prefix",
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
    </>
  );
}
