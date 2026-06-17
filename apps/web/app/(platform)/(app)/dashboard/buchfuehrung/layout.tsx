"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const BUCHFUEHRUNG_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/buchfuehrung/rechnungen",
    label: "Rechnungen",
    matchMode: "exact",
    activeWhen: ["/dashboard/buchfuehrung"],
  },
  {
    href: "/dashboard/buchfuehrung/angebote",
    label: "Angebote",
    matchMode: "exact",
  },
  {
    href: "/dashboard/buchfuehrung/belege",
    label: "Belege",
    matchMode: "exact",
  },
  {
    href: "/dashboard/buchfuehrung/kasse",
    label: "Kasse",
    matchMode: "exact",
  },
  {
    href: "/dashboard/buchfuehrung/statistiken",
    label: "Statistiken",
    matchMode: "exact",
  },
  {
    href: "/dashboard/buchfuehrung/einstellungen",
    label: "Einstellungen",
    matchMode: "exact",
  },
];

export default function BuchfuehrungLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Buchführung"
        subnavAriaLabel="Buchführung-Bereiche"
        subnavItems={BUCHFUEHRUNG_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
