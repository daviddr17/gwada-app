"use client";

import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { SUPERADMIN_SYSTEM_NAV } from "@/lib/navigation/superadmin-system-routes";

export default function SuperadminDatenbankLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="System"
        subnavAriaLabel="Superadmin System"
        subnavItems={SUPERADMIN_SYSTEM_NAV}
      />
      {children}
    </>
  );
}
