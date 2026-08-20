"use client";

import { useMemo } from "react";
import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

const SETTINGS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.settings.restaurant,
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.settings.dashboard,
    label: "Dashboard",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.settings.team,
    label: "Team",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.settings.openingHours,
    label: "Öffnungszeiten",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.settings.integrations,
    label: "Integrationen",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.settings.displays,
    label: "Displays",
    matchMode: "prefix",
  },
  {
    href: APP_ROUTES.settings.api,
    label: "API",
    matchMode: "exact",
  },
];

const BILLING_NAV_ITEM: ModuleSubnavItem = {
  href: APP_ROUTES.settings.billing,
  label: "Abo",
  matchMode: "exact",
};

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { has, loading: permLoading } = useRestaurantPermissions();
  const subnavItems = useMemo(() => {
    if (permLoading || has("billing.manage")) {
      return [...SETTINGS_NAV, BILLING_NAV_ITEM];
    }
    return SETTINGS_NAV;
  }, [has, permLoading]);

  return (
    <>
      <RegisterModuleChrome
        title="Einstellungen"
        subnavAriaLabel="Einstellungsbereiche"
        subnavItems={subnavItems}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
