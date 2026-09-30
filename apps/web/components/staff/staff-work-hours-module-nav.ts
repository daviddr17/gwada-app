"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

/** Zweite Chip-Leiste unter Mitarbeiter → Arbeitszeiten. */
export const STAFF_WORK_HOURS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/staff/work-hours",
    label: "Kalender",
    matchMode: "exact",
  },
  {
    href: "/dashboard/staff/work-hours/fix",
    label: "Beheben",
    matchMode: "exact",
  },
  {
    href: "/dashboard/staff/work-hours/payroll",
    label: "Abrechnung",
    matchMode: "exact",
  },
];

export function isStaffWorkHoursModulePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/dashboard/staff/work-hours");
}
