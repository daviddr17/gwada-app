"use client";

import type { QueryClient } from "@tanstack/react-query";

/**
 * Absolute Deckel ab Mount — Overlay darf Klicks nie länger blockieren,
 * auch nicht während Auth/Workspace noch auflösen.
 */
export const APP_SHELL_READY_MAX_MS = 1_200;

export type AppShellReadinessInputs = {
  authReady: boolean;
  workspaceReady: boolean;
  supabaseEnvOk: boolean;
  restaurantId: string | null;
  permissionsLoading: boolean;
  permissionsCount: number;
  queryClient: QueryClient;
};

/**
 * Bootstrap freigeben sobald Auth + Workspace da sind.
 * Permissions/Modul-Daten laden im Hintergrund — nicht die erste Interaktion blockieren.
 */
export function computeAppShellInteractive(
  inputs: AppShellReadinessInputs,
): boolean {
  const { authReady, workspaceReady } = inputs;
  return authReady && workspaceReady;
}
