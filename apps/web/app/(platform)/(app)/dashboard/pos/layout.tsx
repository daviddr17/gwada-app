"use client";

import { Suspense } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { hasPosModuleAccess } from "@/lib/permissions/sidebar-module-permissions";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

const POS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.pos.overview,
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: [APP_ROUTES.pos.root],
  },
  {
    href: APP_ROUTES.pos.orders,
    label: "Bestellungen",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.receipts,
    label: "Quittungen",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.statistics,
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.reports,
    label: "Berichte",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.pos.settings,
    label: "Einstellungen",
    matchMode: "prefix",
  },
];

function PosLayoutInner({ children }: { children: React.ReactNode }) {
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canAccess = hasPosModuleAccess(has);

  if (!permissionsLoading && !canAccess) {
    return (
      <>
        <RegisterModuleChrome
          title="POS"
          subnavAriaLabel="POS-Bereiche"
          subnavItems={POS_NAV}
        />
        <AppMain>
          <ModuleAccessDenied label="POS" />
        </AppMain>
      </>
    );
  }

  return (
    <>
      <RegisterModuleChrome
        title="POS"
        subnavAriaLabel="POS-Bereiche"
        subnavItems={POS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}

export default function PosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <PosLayoutInner>{children}</PosLayoutInner>
    </Suspense>
  );
}
