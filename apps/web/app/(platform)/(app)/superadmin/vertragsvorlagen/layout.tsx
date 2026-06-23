"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/vertragsvorlagen",
    label: "Übersicht",
    matchMode: "exact",
  },
];

export default function SuperadminContractTemplatesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Vertragsvorlagen"
        subnavAriaLabel="Superadmin Vertragsvorlagen"
        subnavItems={NAV}
      />
      {children}
    </>
  );
}
