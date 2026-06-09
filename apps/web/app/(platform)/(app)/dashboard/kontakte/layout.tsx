"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { UnifiedInboxBackgroundSyncMount } from "@/components/contacts/unified-inbox-background-sync-mount";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const MESSAGES_MODULE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dashboard/kontakte/nachrichten",
    label: "Nachrichten",
    matchMode: "prefix",
    activeWhen: ["/dashboard/kontakte"],
  },
  {
    href: "/dashboard/kontakte/uebersicht",
    label: "Kontakte",
    matchMode: "prefix",
  },
  {
    href: "/dashboard/kontakte/export",
    label: "Export",
    matchMode: "exact",
  },
  {
    href: "/dashboard/kontakte/einstellungen",
    label: "Einstellungen",
    matchMode: "prefix",
  },
];

export default function KontakteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <UnifiedInboxBackgroundSyncMount />
      <RegisterModuleChrome
        title="Nachrichten"
        subnavAriaLabel="Nachrichten-Bereiche"
        subnavItems={MESSAGES_MODULE_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
