"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const WAHA_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/waha",
    label: "Server",
    matchMode: "exact",
  },
];

export default function SuperadminWahaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="WAHA"
        subnavAriaLabel="Superadmin WAHA"
        subnavItems={WAHA_NAV}
      />
      {children}
    </>
  );
}
