"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Bewertungen-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const REVIEWS_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.bewertungen.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.bewertungen.root],
  },
  {
    href: APP_ROUTES.bewertungen.statistics,
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.bewertungen.embed,
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.bewertungen.settings,
    label: "Einstellungen",
    matchMode: "prefix",
  },
];
