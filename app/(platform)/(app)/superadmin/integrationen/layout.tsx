"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const INTEGRATIONEN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/integrationen",
    label: "Übersicht",
    matchMode: "prefix",
  },
];

export default function SuperadminIntegrationenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Integrationen"
        subnavAriaLabel="Integrationen-Bereich"
        subnavItems={INTEGRATIONEN_NAV}
      />
      {children}
    </>
  );
}
