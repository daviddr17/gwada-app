"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Bestand-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const INVENTORY_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.inventory.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.inventory.root],
  },
  {
    href: APP_ROUTES.inventory.order,
    label: "Bestellung",
    matchMode: "prefix",
    activeWhen: [APP_ROUTES.inventory.order],
  },
  {
    href: APP_ROUTES.inventory.statistics,
    label: "Statistiken",
    matchMode: "exact",
  },
];
