"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const MESSAGES_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/kontakte/nachrichten",
    label: "Nachrichten",
    matchMode: "prefix",
    activeWhen: ["/kontakte"],
  },
  {
    href: "/kontakte/uebersicht",
    label: "Kontakte",
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
        title="Nachrichten"
        subnavAriaLabel="Nachrichten-Bereiche"
        subnavItems={MESSAGES_MODULE_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
