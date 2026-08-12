"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { NewsScreen } from "@/components/news/news-screen";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const NEWS_NAV: readonly ModuleSubnavItem[] = [
  { href: "/dashboard/news/uebersicht", label: "Übersicht", matchMode: "exact", activeWhen: ["/dashboard/news"] },
  { href: "/dashboard/news/autopilot", label: "Autopilot", matchMode: "prefix" },
  { href: "/dashboard/news/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/news/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/news/einstellungen", label: "Einstellungen", matchMode: "prefix" },
];

export function NewsOverviewKeepAliveScreen({
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
      title="News"
      subnavAriaLabel="News-Bereiche"
      subnavItems={NEWS_NAV}
    >
      <NewsScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
