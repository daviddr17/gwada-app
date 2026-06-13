"use client";

/**
 * Zone-Layout für `/dashboard/*` — Page-Inhalt aus `{children}`.
 */
export function DashboardZoneShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

export { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
