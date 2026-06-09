"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import { cn } from "@/lib/utils";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { StaffModuleStickyBar } from "@/components/staff/staff-module-sticky-bar";
import { StaffModuleSelectionProvider } from "@/lib/contexts/staff-module-selection-context";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const STAFF_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/mitarbeiter/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/mitarbeiter"],
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
    href: "/dashboard/mitarbeiter/arbeitszeiten",
    label: "Arbeitszeiten",
    matchMode: "exact",
  },
  {
    href: "/dashboard/mitarbeiter/export",
    label: "Export",
    matchMode: "exact",
  },
];

function MitarbeiterLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const needsStaffPicker =
    pathname.startsWith("/dashboard/mitarbeiter/vertraege") ||
    pathname.startsWith("/dashboard/mitarbeiter/arbeitszeiten") ||
    pathname.startsWith("/dashboard/mitarbeiter/export");

  return (
    <StaffModuleSelectionProvider needsStaffPicker={needsStaffPicker}>
      <RegisterModuleChrome
        title="Mitarbeiter"
        subnavAriaLabel="Mitarbeiter-Bereiche"
        subnavItems={STAFF_NAV}
      />
      <AppMain className={cn(needsStaffPicker && "!pt-0")}>
        {needsStaffPicker ? (
          <>
            <StaffModuleStickyBar />
            <div className="relative z-0 pt-4">{children}</div>
          </>
        ) : (
          children
        )}
      </AppMain>
    </StaffModuleSelectionProvider>
  );
}

export default function MitarbeiterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <MitarbeiterLayoutInner>{children}</MitarbeiterLayoutInner>
    </Suspense>
  );
}
