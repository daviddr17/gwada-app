"use client";

import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const EVENTS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/events/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/events"],
  },
  {
    href: "/dashboard/events/statistiken",
    label: "Statistiken",
    matchMode: "prefix",
  },
  {
    href: "/dashboard/events/einbinden",
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: "/dashboard/events/einstellungen",
    label: "Einstellungen",
    matchMode: "prefix",
  },
];

export default function EventsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Events"
        subnavAriaLabel="Events-Bereiche"
        subnavItems={EVENTS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
