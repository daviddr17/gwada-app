"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Dokumente-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const DOCUMENTS_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.dokumente.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.dokumente.root],
  },
  {
    href: APP_ROUTES.dokumente.statistics,
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.dokumente.log,
    label: "Protokoll",
    matchMode: "exact",
  },
];
