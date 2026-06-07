"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const RESERVATIONS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/reservierungen/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/reservierungen"],
  },
  {
    href: "/reservierungen/tischplan",
    label: "Tischplan",
    matchMode: "prefix",
  },
  {
    href: "/reservierungen/statistiken",
    label: "Statistiken",
    matchMode: "prefix",
  },
  {
    href: "/reservierungen/einstellungen",
    label: "Einstellungen",
    matchMode: "prefix",
  },
  {
    href: "/reservierungen/einbinden",
    label: "Einbinden",
    matchMode: "prefix",
  },
];

export default function ReservierungenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Reservierungen"
        subnavAriaLabel="Reservierungs-Bereiche"
        subnavItems={RESERVATIONS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
