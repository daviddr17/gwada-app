import { preload } from "react-dom";
import { dashboardPwaIconPath } from "@/lib/dashboard/dashboard-pwa-config";

/** Splash-Icon früh laden — nahtloser Übergang vom OS-Splash. */
export function DashboardPwaSplashPreload() {
  preload(dashboardPwaIconPath(192), {
    as: "image",
    fetchPriority: "high",
  });
  return null;
}
