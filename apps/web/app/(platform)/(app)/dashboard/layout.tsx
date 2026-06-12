import { DashboardZoneShell } from "@/components/dashboard/dashboard-zone-shell";

export default function DashboardZoneLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardZoneShell>{children}</DashboardZoneShell>;
}
