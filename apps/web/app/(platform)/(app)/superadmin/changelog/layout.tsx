"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const CHANGELOG_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/changelog",
    label: "Übersicht",
    matchMode: "exact",
  },
];

export default function SuperadminChangelogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Changelog"
        subnavAriaLabel="Superadmin Changelog"
        subnavItems={CHANGELOG_NAV}
      />
      {children}
    </>
  );
}
