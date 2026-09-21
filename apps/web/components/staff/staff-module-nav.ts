"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

/** Mitarbeiter-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const STAFF_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/mitarbeiter/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/mitarbeiter"],
  },
  {
    href: "/dashboard/mitarbeiter/arbeitszeiten",
    label: "Arbeitszeiten",
    matchMode: "exact",
    activeWhen: [
      "/dashboard/mitarbeiter/arbeitszeiten/beheben",
      "/dashboard/mitarbeiter/arbeitszeiten/abrechnung",
    ],
  },
  {
    href: "/dashboard/mitarbeiter/schichtplan",
    label: "Schichtplan",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/vertraege",
    label: "Verträge",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/dokumente",
    label: "Dokumente",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/einstellungen",
    label: "Einstellungen",
    matchMode: "prefix",
  },
];
