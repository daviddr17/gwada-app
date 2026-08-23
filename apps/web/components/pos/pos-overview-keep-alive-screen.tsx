"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { PosOverviewScreen } from "@/components/pos/pos-overview-screen";
import { POS_MODULE_NAV } from "@/components/pos/pos-module-nav";

export function PosOverviewKeepAliveScreen({
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
      title="POS"
      subnavAriaLabel="POS-Bereiche"
      subnavItems={POS_MODULE_NAV}
      mainClassName="px-4 pb-8 sm:px-6"
    >
      <PosOverviewScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
