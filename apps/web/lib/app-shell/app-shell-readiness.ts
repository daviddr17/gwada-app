"use client";

import type { QueryClient } from "@tanstack/react-query";

/**
 * Visuelles Bootstrap-Overlay ausblenden (nie Klicks sperren).
 * Mit Cache oft sofort; ohne Cache nach kurzem Failsafe.
 */
export const APP_SHELL_READY_MAX_MS = 800;

export type AppShellReadinessInputs = {
  authReady: boolean;
  workspaceReady: boolean;
  supabaseEnvOk: boolean;
  restaurantId: string | null;
  permissionsLoading: boolean;
  permissionsCount: number;
  queryClient: QueryClient;
  /** PWA-/Tab-Warmstart: Restaurant schon im Cache → sofort Shell zeigen. */
  hasCachedRestaurant?: boolean;
};

/**
 * Shell freigeben sobald Auth + Workspace da sind — oder früher bei Warm-Cache.
 * Permissions/Modul-Daten laden im Hintergrund; Overlay blockiert keine Klicks.
 */
export function computeAppShellInteractive(
  inputs: AppShellReadinessInputs,
): boolean {
  if (inputs.hasCachedRestaurant && inputs.workspaceReady) return true;
  const { authReady, workspaceReady } = inputs;
  return authReady && workspaceReady;
}
