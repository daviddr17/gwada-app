"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Galerie-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const GALLERY_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.galerie.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.galerie.root],
  },
  {
    href: APP_ROUTES.galerie.statistics,
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.galerie.embed,
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.galerie.settings,
    label: "Einstellungen",
    matchMode: "prefix",
  },
];
