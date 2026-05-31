"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const CONTACTS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/kontakte/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/kontakte"],
  },
  {
    href: "/kontakte/nachrichten",
    label: "Nachrichten",
    matchMode: "prefix",
  },
  {
    href: "/kontakte/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/kontakte/einstellungen",
    label: "Einstellungen",
    matchMode: "prefix",
  },
];

export default function KontakteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Kontakte"
        subnavAriaLabel="Kontakte-Bereiche"
        subnavItems={CONTACTS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
