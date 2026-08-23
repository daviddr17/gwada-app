"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Events-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const EVENTS_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.events.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.events.root],
  },
  {
    href: APP_ROUTES.events.statistics,
    label: "Statistiken",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.events.embed,
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.events.settings,
    label: "Einstellungen",
    matchMode: "prefix",
  },
];
