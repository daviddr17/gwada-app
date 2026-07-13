"use client";

import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const INSIGHTS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/insights/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/insights"],
  },
  {
    href: "/dashboard/insights/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
];

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RegisterModuleChrome
        title="Insights"
        subnavAriaLabel="Insights-Bereiche"
        subnavItems={INSIGHTS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
