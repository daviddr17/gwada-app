"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppShellBootstrapOverlay } from "@/components/layout/app-shell-bootstrap-overlay";
import {
  APP_SHELL_READY_MAX_MS,
  computeAppShellInteractive,
} from "@/lib/app-shell/app-shell-readiness";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useRestaurantPermissionsContext } from "@/lib/contexts/restaurant-permissions-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

type AppShellReadinessValue = {
  interactive: boolean;
};

const AppShellReadinessContext = createContext<AppShellReadinessValue>({
  interactive: true,
});

export function useAppShellReadiness(): AppShellReadinessValue {
  return useContext(AppShellReadinessContext);
}

export function AppShellReadinessProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { ready: authReady } = useWorkspaceAuthSession();
  const {
    restaurantId,
    ready: workspaceReady,
    supabaseEnvOk,
  } = useWorkspaceRestaurantUuid();
  const { loading: permissionsLoading, permissions } =
    useRestaurantPermissionsContext();

  const [interactive, setInteractive] = useState(false);
  const unlockedRef = useRef(false);

  const readinessInputs = useMemo(
    () => ({
      authReady,
      workspaceReady,
      supabaseEnvOk,
      restaurantId,
      permissionsLoading,
      permissionsCount: permissions.size,
      queryClient,
    }),
    [
      authReady,
      workspaceReady,
      supabaseEnvOk,
      restaurantId,
      permissionsLoading,
      permissions.size,
      queryClient,
    ],
  );

  const markInteractive = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    setInteractive(true);
  }, []);

  const tryMarkInteractive = useCallback(() => {
    if (computeAppShellInteractive(readinessInputs)) {
      markInteractive();
      return true;
    }
    return false;
  }, [markInteractive, readinessInputs]);

  // Failsafe ab Mount — nie endlos pointer-blocking, auch vor Auth-Ready.
  useEffect(() => {
    const maxTimer = window.setTimeout(markInteractive, APP_SHELL_READY_MAX_MS);
    return () => window.clearTimeout(maxTimer);
  }, [markInteractive]);

  useLayoutEffect(() => {
    tryMarkInteractive();
  }, [tryMarkInteractive]);

  const value = useMemo(() => ({ interactive }), [interactive]);

  return (
    <AppShellReadinessContext.Provider value={value}>
      {children}
      {!interactive ? <AppShellBootstrapOverlay /> : null}
    </AppShellReadinessContext.Provider>
  );
}
