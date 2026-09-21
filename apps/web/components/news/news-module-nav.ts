"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** News-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const NEWS_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.news.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.news.root],
  },
  {
    href: APP_ROUTES.news.autopilot,
    label: "Autopilot",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.news.statistics,
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.news.embed,
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.news.settings,
    label: "Einstellungen",
    matchMode: "prefix",
  },
];
