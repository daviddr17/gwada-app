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
  ensureCriticalModuleDataReady,
  seedPriorityModuleQueryCaches,
} from "@/lib/app-shell/app-shell-readiness";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useRestaurantPermissionsContext } from "@/lib/contexts/restaurant-permissions-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

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
  const warmedForRef = useRef<string | null>(null);

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

  const tryMarkInteractive = useCallback(() => {
    if (computeAppShellInteractive(readinessInputs)) {
      setInteractive(true);
      return true;
    }
    return false;
  }, [readinessInputs]);

  useLayoutEffect(() => {
    if (!authReady || !workspaceReady) {
      setInteractive(false);
      return;
    }

    if (tryMarkInteractive()) {
      if (
        restaurantId &&
        isUuidRestaurantId(restaurantId) &&
        warmedForRef.current !== restaurantId
      ) {
        warmedForRef.current = restaurantId;
        seedPriorityModuleQueryCaches(queryClient, restaurantId);
        void ensureCriticalModuleDataReady(queryClient, restaurantId);
      }
      return;
    }

    let cancelled = false;
    const maxTimer = window.setTimeout(() => {
      if (!cancelled) setInteractive(true);
    }, APP_SHELL_READY_MAX_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(maxTimer);
    };
  }, [authReady, workspaceReady, restaurantId, queryClient, tryMarkInteractive]);

  useEffect(() => {
    tryMarkInteractive();
  }, [permissionsLoading, permissions.size, tryMarkInteractive]);

  const value = useMemo(() => ({ interactive }), [interactive]);

  return (
    <AppShellReadinessContext.Provider value={value}>
      {children}
      {!interactive ? <AppShellBootstrapOverlay /> : null}
    </AppShellReadinessContext.Provider>
  );
}
