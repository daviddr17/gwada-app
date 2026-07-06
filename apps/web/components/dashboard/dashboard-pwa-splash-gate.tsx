"use client";

import { type ReactNode } from "react";
import { PwaSplashGate } from "@/components/pwa/pwa-splash-gate";
import { dashboardPwaIconPath } from "@/lib/dashboard/dashboard-pwa-config";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const SPLASH_ICON_SRC = dashboardPwaIconPath(192);

type DashboardPwaSplashGateProps = {
  children: ReactNode;
};

export function DashboardPwaSplashGate({ children }: DashboardPwaSplashGateProps) {
  const { ready: authReady } = useWorkspaceAuthSession();
  const { ready: workspaceReady } = useWorkspaceRestaurantUuid();

  return (
    <PwaSplashGate
      app="dashboard"
      iconSrc={SPLASH_ICON_SRC}
      isReady={authReady && workspaceReady}
    >
      {children}
    </PwaSplashGate>
  );
}
