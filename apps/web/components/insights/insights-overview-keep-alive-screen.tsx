"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { InsightsOverviewScreen } from "@/components/insights/insights-overview-screen";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const INSIGHTS_NAV: readonly ModuleSubnavItem[] = [
  { href: "/dashboard/insights/uebersicht", label: "Übersicht", matchMode: "exact", activeWhen: ["/dashboard/insights"] },
];

export function InsightsOverviewKeepAliveScreen({ active }: { active: boolean }) {
  return (
    <ModuleHomeKeepAliveShell
      active={active}
      title="Insights"
      subnavAriaLabel="Insights-Bereiche"
      subnavItems={INSIGHTS_NAV}
    >
      <InsightsOverviewScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
