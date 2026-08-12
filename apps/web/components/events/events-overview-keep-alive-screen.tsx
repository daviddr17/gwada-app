"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { EventsScreen } from "@/components/events/events-screen";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const EVENTS_NAV: readonly ModuleSubnavItem[] = [
  { href: "/dashboard/events/uebersicht", label: "Übersicht", matchMode: "exact", activeWhen: ["/dashboard/events"] },
  { href: "/dashboard/events/statistiken", label: "Statistiken", matchMode: "prefix" },
  { href: "/dashboard/events/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/events/einstellungen", label: "Einstellungen", matchMode: "prefix" },
];

export function EventsOverviewKeepAliveScreen({
  active,
  showChrome = active,
}: {
  active: boolean;
  showChrome?: boolean;
}) {
  return (
    <ModuleHomeKeepAliveShell
      active={active}
      showChrome={showChrome}
      title="Events"
      subnavAriaLabel="Events-Bereiche"
      subnavItems={EVENTS_NAV}
    >
      <EventsScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
