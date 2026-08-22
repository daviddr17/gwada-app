"use client";

import { usePathname } from "next/navigation";
import { DashboardSPA } from "@gwada/dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { SoftNavLockProvider } from "@/components/providers/soft-nav-lock-provider";

function isDashboardZone(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

/**
 * Dashboard = Vite/TanStack SPA. Superadmin & Rest = Next AppShell + Soft-Nav.
 */
export function AppZoneRouter({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  if (isDashboardZone(pathname)) {
    return <DashboardSPA />;
  }

  return (
    <SoftNavLockProvider>
      <AppShell>{children}</AppShell>
    </SoftNavLockProvider>
  );
}
