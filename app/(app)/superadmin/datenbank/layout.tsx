"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const DATENBANK_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/datenbank",
    label: "Übersicht",
    matchMode: "exact",
  },
];

export default function SuperadminDatenbankLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Datenbank"
        subnavAriaLabel="Datenbank-Bereich"
        subnavItems={DATENBANK_NAV}
      />
      {children}
    </>
  );
}
