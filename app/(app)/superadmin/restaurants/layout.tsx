"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const RESTAURANTS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/restaurants",
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: "/superadmin/restaurants/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/superadmin/restaurants/statistiken",
    label: "Statistiken",
    matchMode: "prefix",
  },
];

export default function SuperadminRestaurantsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Restaurants"
        subnavAriaLabel="Restaurants-Bereich"
        subnavItems={RESTAURANTS_NAV}
      />
      {children}
    </>
  );
}
