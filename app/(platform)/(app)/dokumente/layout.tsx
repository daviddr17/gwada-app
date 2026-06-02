"use client";

import { AppMain } from "@/components/layout/app-main";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const DOCUMENTS_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/dokumente/uebersicht",
    label: "Übersicht",
    matchMode: "exact",
    activeWhen: ["/dokumente"],
  },
  {
    href: "/dokumente/protokoll",
    label: "Protokoll",
    matchMode: "exact",
  },
];

export default function DokumenteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Dokumente"
        subnavAriaLabel="Dokumente-Bereiche"
        subnavItems={DOCUMENTS_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
