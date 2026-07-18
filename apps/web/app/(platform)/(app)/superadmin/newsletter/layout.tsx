"use client";

import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

const NEWSLETTER_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/superadmin/newsletter",
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: "/superadmin/newsletter/vorlagen",
    label: "Vorlagen",
    matchMode: "exact",
  },
];

export default function SuperadminNewsletterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Newsletter"
        subnavAriaLabel="Superadmin Newsletter"
        subnavItems={NEWSLETTER_NAV}
      />
      {children}
    </>
  );
}
