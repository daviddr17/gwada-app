"use client";

import { usePathname } from "next/navigation";
import { DashboardSPA } from "@gwada/dashboard";
import { SuperadminSPA } from "@gwada/superadmin";
import { AppShell } from "@/components/layout/app-shell";
import { SoftNavLockProvider } from "@/components/providers/soft-nav-lock-provider";

function isDashboardZone(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isSuperadminZone(pathname: string): boolean {
  return pathname === "/superadmin" || pathname.startsWith("/superadmin/");
}

/**
 * Dashboard + Superadmin = Vite/TanStack SPA.
 * Workspace & Rest = Next AppShell + Soft-Nav.
 */
export function AppZoneRouter({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  if (isDashboardZone(pathname)) {
    return <DashboardSPA />;
  }

  if (isSuperadminZone(pathname)) {
    return <SuperadminSPA />;
  }

  return (
    <SoftNavLockProvider>
      <AppShell>{children}</AppShell>
    </SoftNavLockProvider>
  );
}
