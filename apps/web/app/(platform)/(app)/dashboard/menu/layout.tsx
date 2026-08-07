"use client";

import { usePathname } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { isModuleHomePath } from "@/lib/navigation/module-home-keep-alive";

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

export default function MenuLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  // Übersicht: Keep-alive unter App-Shell besitzt Chrome + Inhalt.
  if (isModuleHomePath(pathname, "menu")) {
    return null;
  }

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
