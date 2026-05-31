"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const ALLGEMEIN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/allgemein",
    label: "Allgemein",
    matchMode: "exact",
  },
];

export default function SuperadminAllgemeinLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Allgemein"
        subnavAriaLabel="Superadmin Allgemein"
        subnavItems={ALLGEMEIN_NAV}
      />
      {children}
    </>
  );
}
