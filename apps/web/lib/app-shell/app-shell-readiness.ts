"use client";

import type { QueryClient } from "@tanstack/react-query";
import {
  ensureCriticalModuleDataReady,
  isCriticalModuleDataReady,
  seedPriorityModuleQueryCaches,
} from "@/lib/hooks/app-module-intent-prefetch";

/** Notfall-Deckel — Shell nie länger als nötig blockieren. */
export const APP_SHELL_READY_MAX_MS = 3_500;

export { ensureCriticalModuleDataReady, isCriticalModuleDataReady, seedPriorityModuleQueryCaches };

export type AppShellReadinessInputs = {
  authReady: boolean;
  workspaceReady: boolean;
  supabaseEnvOk: boolean;
  restaurantId: string | null;
  permissionsLoading: boolean;
  permissionsCount: number;
  queryClient: QueryClient;
};

export function computeAppShellInteractive(
  inputs: AppShellReadinessInputs,
): boolean {
  const {
    authReady,
    workspaceReady,
    supabaseEnvOk,
    restaurantId,
    permissionsLoading,
    permissionsCount,
    queryClient,
  } = inputs;
  if (!authReady || !workspaceReady) return false;
  if (!supabaseEnvOk) return true;
  if (!restaurantId) return true;
  if (permissionsLoading && permissionsCount === 0) return false;
  return isCriticalModuleDataReady(queryClient, restaurantId);
}
