"use client";

import { AppMain } from "@/components/layout/app-main";
import { SuperadminGuard } from "@/components/superadmin/superadmin-guard";

export default function SuperadminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SuperadminGuard>
      <AppMain>{children}</AppMain>
    </SuperadminGuard>
  );
}
