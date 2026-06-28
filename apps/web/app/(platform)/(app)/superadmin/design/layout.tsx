"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const DESIGN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/design",
    label: "Referenz",
    matchMode: "exact",
  },
];

export default function SuperadminDesignLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Design"
        subnavAriaLabel="Superadmin Design"
        subnavItems={DESIGN_NAV}
      />
      {children}
    </>
  );
}
