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
import { useSoftNavLock } from "@/components/providers/soft-nav-lock-provider";
import {
  APP_SHELL_READY_MAX_MS,
  computeAppShellInteractive,
} from "@/lib/app-shell/app-shell-readiness";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useRestaurantPermissionsContext } from "@/lib/contexts/restaurant-permissions-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { peekCachedWorkspaceRestaurantId } from "@/lib/supabase/workspace-persistence";

type AppShellReadinessValue = {
  interactive: boolean;
  /** Bootstrap sofort ausblenden (z. B. Menü geöffnet / Soft-Nav). */
  dismissBootstrap: () => void;
};

const AppShellReadinessContext = createContext<AppShellReadinessValue>({
  interactive: true,
  dismissBootstrap: () => {},
});

export function useAppShellReadiness(): AppShellReadinessValue {
  return useContext(AppShellReadinessContext);
}

function hasWarmRestaurantCache(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(peekCachedWorkspaceRestaurantId());
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
  const { pendingHref } = useSoftNavLock();

  const warmCacheRef = useRef(hasWarmRestaurantCache());
  const [interactive, setInteractive] = useState(
    () => warmCacheRef.current,
  );
  const unlockedRef = useRef(warmCacheRef.current);

  const readinessInputs = useMemo(
    () => ({
      authReady,
      workspaceReady,
      supabaseEnvOk,
      restaurantId,
      permissionsLoading,
      permissionsCount: permissions.size,
      queryClient,
      hasCachedRestaurant: warmCacheRef.current || Boolean(restaurantId),
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

  // Failsafe — Overlay nur kurz sichtbar; Klicks nie gesperrt (pointer-events-none).
  useEffect(() => {
    if (unlockedRef.current) return;
    const maxTimer = window.setTimeout(markInteractive, APP_SHELL_READY_MAX_MS);
    return () => window.clearTimeout(maxTimer);
  }, [markInteractive]);

  useLayoutEffect(() => {
    tryMarkInteractive();
  }, [tryMarkInteractive]);

  // Sofort Soft-Nav: Bootstrap ausblenden, sobald Nutzer ein Modul antippt.
  useLayoutEffect(() => {
    if (pendingHref) markInteractive();
  }, [pendingHref, markInteractive]);

  const value = useMemo(
    () => ({ interactive, dismissBootstrap: markInteractive }),
    [interactive, markInteractive],
  );

  return (
    <AppShellReadinessContext.Provider value={value}>
      {children}
      {!interactive ? <AppShellBootstrapOverlay /> : null}
    </AppShellReadinessContext.Provider>
  );
}
