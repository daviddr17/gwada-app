import type { RouteSweepMeta } from "@/components/layout/route-sweep-overlay";
import { LogOut } from "lucide-react";

export const AUTH_LOGOUT_META: RouteSweepMeta = {
  id: "auth-logout",
  label: "Abmelden",
  subtitle: "Bis bald",
  Icon: LogOut,
  iconClassName: "bg-muted text-muted-foreground",
};
