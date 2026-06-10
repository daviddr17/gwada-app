import { LayoutDashboard, Shield } from "lucide-react";
import type { RouteSweepMeta } from "@/components/layout/route-sweep-overlay";

export type AppWorkspaceZone = "superadmin" | "app";

export function appZoneFromPath(pathname: string): AppWorkspaceZone {
  return pathname.startsWith("/superadmin") ? "superadmin" : "app";
}

export const WORKSPACE_ZONE_SWEEP_META: Record<AppWorkspaceZone, RouteSweepMeta> =
  {
    superadmin: {
      id: "zone-superadmin",
      label: "Superadmin",
      subtitle: "Plattform & Mandanten",
      Icon: Shield,
      iconClassName: "bg-violet-500/15 text-violet-700 dark:text-violet-200",
      accentClassName: "from-violet-600/88 via-indigo-500/55 to-transparent",
    },
    app: {
      id: "zone-app",
      label: "Dashboard",
      subtitle: "Restaurant-Bereich",
      Icon: LayoutDashboard,
      iconClassName: "bg-accent/15 text-accent-foreground",
      accentClassName:
        "from-[color-mix(in_oklch,var(--accent)_82%,transparent)] via-[color-mix(in_oklch,var(--accent)_38%,transparent)] to-transparent",
    },
  };
