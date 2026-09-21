"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { EventsScreen } from "@/components/events/events-screen";
import { EVENTS_MODULE_NAV } from "@/components/events/events-module-nav";

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
      subnavItems={EVENTS_MODULE_NAV}
    >
      <EventsScreen active={active} showChrome={showChrome} />
    </ModuleHomeKeepAliveShell>
  );
}
