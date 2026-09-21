"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

/** Speisekarte-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const MENU_MODULE_NAV: readonly ModuleSubnavItem[] = [
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
