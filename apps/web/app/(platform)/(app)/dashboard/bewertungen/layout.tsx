"use client";

import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const BEWERTUNGEN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/bewertungen/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dashboard/bewertungen"],
  },
  {
    href: "/dashboard/bewertungen/einbinden",
    label: "Einbinden",
    matchMode: "prefix",
  },
];

export default function BewertungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RegisterModuleChrome
        title="Bewertungen"
        subnavAriaLabel="Bewertungen-Bereiche"
        subnavItems={BEWERTUNGEN_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
