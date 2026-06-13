"use client";

export { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";

/** Zone-Layout: normales `{children}` — kein paralleles Shell-UI (RSC-Sync). */
export function DashboardZoneShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
