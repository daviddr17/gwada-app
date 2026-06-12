"use client";

import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";

export default function SuperadminLadeStrategieLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RegisterModuleChrome
        title="Lade- & Cache-Strategie"
        subnavAriaLabel={null}
        subnavItems={null}
      />
      {children}
    </>
  );
}
