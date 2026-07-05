"use client";

import { useWorkspaceRestaurantContext } from "@/lib/contexts/workspace-restaurant-context";

/** Liest Workspace-Restaurant aus dem App-weiten Provider (eine Instanz, kein Doppel-Fetch). */
export function useWorkspaceRestaurantUuid() {
  return useWorkspaceRestaurantContext();
}
