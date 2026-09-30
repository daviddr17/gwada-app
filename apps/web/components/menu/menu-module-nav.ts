"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

/** Speisekarte-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const MENU_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/menu/overview",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/menu"],
  },
  {
    href: "/dashboard/menu/statistics",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/menu/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/dashboard/menu/embed",
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: "/dashboard/menu/settings",
    label: "Einstellungen",
    matchMode: "exact",
  },
];
