"use client";

import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { SUPERADMIN_VORLAGEN_NAV } from "@/lib/navigation/superadmin-vorlagen-routes";

export default function SuperadminVorlagenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Vorlagen"
        subnavAriaLabel="Superadmin Vorlagen"
        subnavItems={SUPERADMIN_VORLAGEN_NAV}
      />
      {children}
    </>
  );
}
