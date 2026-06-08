"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const SETTINGS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/settings/restaurant",
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: "/settings/team",
    label: "Team",
    matchMode: "prefix",
  },
  {
    href: "/settings/rollen",
    label: "Rollen",
    matchMode: "prefix",
  },
  {
    href: "/settings/oeffnungszeiten",
    label: "Öffnungszeiten",
    matchMode: "prefix",
  },
  {
    href: "/settings/dashboard",
    label: "Dashboard",
    matchMode: "exact",
  },
  {
    href: "/settings/integrationen",
    label: "Integrationen",
    matchMode: "prefix",
  },
  {
    href: "/settings/kasse",
    label: "Kasse & TSE",
    matchMode: "prefix",
  },
  {
    href: "/settings/branding",
    label: "Branding",
    matchMode: "prefix",
  },
  {
    href: "/settings/displays",
    label: "Displays",
    matchMode: "prefix",
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
