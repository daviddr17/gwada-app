"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";

const STORAGE_KEY = "gwada-menu-view-mode";

export type MenuViewMode = "cards" | "compact";

function parseMenuViewMode(raw: unknown): MenuViewMode {
  return raw === "compact" ? "compact" : "cards";
}

export function useMenuViewMode() {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [mode, setModeState] = useState<MenuViewMode>("cards");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const next = parseMenuViewMode(loadWorkspaceJsonLocal(STORAGE_KEY));
    if (cancelled) return;
    setModeState(next);
    setReady(true);
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback(
    (next: MenuViewMode) => {
      const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
      if (!ok) {
        failSave();
        return;
      }
      setModeState(next);
    },
    [failSave],
  );

  return { mode, setMode, ready };
}
