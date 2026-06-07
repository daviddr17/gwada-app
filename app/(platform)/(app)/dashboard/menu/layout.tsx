"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const MENU_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/menu/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/menu"],
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
];

export default function MenuLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Speisekarte"
        subnavAriaLabel="Speisekarten-Bereiche"
        subnavItems={MENU_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
