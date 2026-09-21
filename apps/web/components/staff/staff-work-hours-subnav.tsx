"use client";

import { usePathname } from "next/navigation";
import { RegisterModuleSecondarySubnav } from "@/lib/contexts/app-module-chrome-context";
import {
  isStaffWorkHoursModulePath,
  STAFF_WORK_HOURS_NAV,
} from "@/components/staff/staff-work-hours-module-nav";

/** Registriert Kalender / Beheben unter der Mitarbeiter-Subnav. */
export function StaffWorkHoursSubnav() {
  const pathname = usePathname();
  if (!isStaffWorkHoursModulePath(pathname)) return null;
  return (
    <RegisterModuleSecondarySubnav
      ariaLabel="Arbeitszeiten-Bereiche"
      items={STAFF_WORK_HOURS_NAV}
    />
  );
}
