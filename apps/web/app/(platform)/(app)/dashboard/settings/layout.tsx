"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
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

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Einstellungen"
        subnavAriaLabel="Einstellungsbereiche"
        subnavItems={SETTINGS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
