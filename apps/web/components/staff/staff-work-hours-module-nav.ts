"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

/** Zweite Chip-Leiste unter Mitarbeiter → Arbeitszeiten. */
export const STAFF_WORK_HOURS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/mitarbeiter/arbeitszeiten",
    label: "Kalender",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/arbeitszeiten/beheben",
    label: "Beheben",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/arbeitszeiten/abrechnung",
    label: "Abrechnung",
    matchMode: "exact",
  },
];

export function isStaffWorkHoursModulePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/dashboard/mitarbeiter/arbeitszeiten");
}
