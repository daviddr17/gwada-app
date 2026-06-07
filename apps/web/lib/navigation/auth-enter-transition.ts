import type { RouteSweepMeta } from "@/components/layout/route-sweep-overlay";
import { LayoutDashboard } from "lucide-react";

export const AUTH_ENTER_APP_META: RouteSweepMeta = {
  id: "auth-enter-app",
  label: "Dashboard",
  subtitle: "Restaurant-Bereich",
  Icon: LayoutDashboard,
  iconClassName: "bg-accent/15 text-accent-foreground",
};
