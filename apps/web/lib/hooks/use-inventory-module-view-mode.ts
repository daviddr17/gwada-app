"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";

export type InventoryModuleViewMode = "standard" | "compact";

export const INVENTORY_STOCK_VIEW_MODE_KEY = "gwada-inventory-stock-view-mode";
export const INVENTORY_PURCHASE_ORDER_VIEW_MODE_KEY =
  "gwada-inventory-purchase-order-view-mode";

function parseInventoryModuleViewMode(raw: unknown): InventoryModuleViewMode {
  return raw === "compact" ? "compact" : "standard";
}

export function useInventoryModuleViewMode(storageKey: string) {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [mode, setModeState] = useState<InventoryModuleViewMode>("standard");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const next = parseInventoryModuleViewMode(loadWorkspaceJsonLocal(storageKey));
    if (cancelled) return;
    setModeState(next);
    setReady(true);
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const setMode = useCallback(
    (next: InventoryModuleViewMode) => {
      const ok = mirrorWorkspaceJsonLocal(storageKey, next);
      if (!ok) {
        failSave();
        return;
      }
      setModeState(next);
    },
    [failSave, storageKey],
  );

  return { mode, setMode, ready };
}
