"use client";

import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const NEWS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/news/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/news"],
  },
  {
    href: "/dashboard/news/autopilot",
    label: "Autopilot",
    matchMode: "prefix",
  },
  {
    href: "/dashboard/news/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/news/einbinden",
    label: "Einbinden",
    matchMode: "prefix",
  },
  {
    href: "/dashboard/news/einstellungen",
    label: "Einstellungen",
    matchMode: "prefix",
  },
];

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RegisterModuleChrome
        title="News"
        subnavAriaLabel="News-Bereiche"
        subnavItems={NEWS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
