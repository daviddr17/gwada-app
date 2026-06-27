"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const WARTELISTE_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/warteliste",
    label: "Übersicht",
    matchMode: "exact",
  },
];

export default function SuperadminWartelisteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Warteliste"
        subnavAriaLabel="Superadmin Warteliste"
        subnavItems={WARTELISTE_NAV}
      />
      {children}
    </>
  );
}
