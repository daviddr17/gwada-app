"use client";

import type { ComponentType, ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { StaffModuleStickyBar } from "@/components/staff/staff-module-sticky-bar";
import { StaffModuleSelectionProvider } from "@/lib/contexts/staff-module-selection-context";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasModuleRead,
} from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { cn } from "@/lib/utils";

const STAFF_NAV: readonly ModuleSubnavItem[] = [
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

function needsStaffPickerPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/mitarbeiter/vertraege") ||
    pathname.startsWith("/dashboard/mitarbeiter/dokumente") ||
    pathname.startsWith("/dashboard/mitarbeiter/arbeitszeiten") ||
    pathname.startsWith("/dashboard/mitarbeiter/export")
  );
}

/** Mitarbeiter-Modul-Chrome + Staff-Picker (früher Next layout). */
export function StaffChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "staff");
  const needsStaffPicker = needsStaffPickerPath(pathname);

  if (!permissionsLoading && !canRead) {
    return (
      <>
        <RegisterModuleChrome
          title="Mitarbeiter"
          subnavAriaLabel="Mitarbeiter-Bereiche"
          subnavItems={STAFF_NAV}
        />
        <AppMain>
          <ModuleAccessDenied label="Mitarbeiter" />
        </AppMain>
      </>
    );
  }

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
            <div className="relative z-0 pt-3 sm:pt-4">{children}</div>
          </>
        ) : (
          children
        )}
      </AppMain>
    </StaffModuleSelectionProvider>
  );
}

export function wrapStaffPage(Page: ComponentType): ComponentType {
  function Wrapped() {
    return (
      <Suspense fallback={null}>
        <StaffChrome>
          <Page />
        </StaffChrome>
      </Suspense>
    );
  }
  Wrapped.displayName = `StaffChrome(${Page.displayName ?? Page.name ?? "Page"})`;
  return Wrapped;
}
