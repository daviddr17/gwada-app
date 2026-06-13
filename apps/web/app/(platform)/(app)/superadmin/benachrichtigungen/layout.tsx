"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const BENACHRICHTIGUNGEN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/benachrichtigungen",
    label: "Log",
    matchMode: "exact",
  },
];

export default function SuperadminBenachrichtigungenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Benachrichtigungen"
        subnavAriaLabel="Superadmin Benachrichtigungen"
        subnavItems={BENACHRICHTIGUNGEN_NAV}
      />
      {children}
    </>
  );
}
