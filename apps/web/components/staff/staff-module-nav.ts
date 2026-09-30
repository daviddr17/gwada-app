"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

/** Mitarbeiter-Subnav — Keep-alive Home + SPA-Unterseiten. */
export const STAFF_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/staff/overview",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/staff"],
  },
  {
    href: "/dashboard/staff/work-hours",
    label: "Arbeitszeiten",
    matchMode: "exact",
    activeWhen: [
      "/dashboard/staff/work-hours/fix",
      "/dashboard/staff/work-hours/payroll",
    ],
  },
  {
    href: "/dashboard/staff/shift-plan",
    label: "Schichtplan",
    matchMode: "exact",
  },
  {
    href: "/dashboard/staff/contracts",
    label: "Verträge",
    matchMode: "exact",
  },
  {
    href: "/dashboard/staff/documents",
    label: "Dokumente",
    matchMode: "exact",
  },
  {
    href: "/dashboard/staff/statistics",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/staff/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/dashboard/staff/settings",
    label: "Einstellungen",
    matchMode: "prefix",
  },
];
