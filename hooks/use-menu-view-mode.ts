"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  loadWorkspaceJson,
  persistWorkspaceState,
} from "@/lib/supabase/workspace-persistence";

const STORAGE_KEY = "gwada-menu-view-mode";

export type MenuViewMode = "cards" | "compact";

export function useMenuViewMode() {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [mode, setModeState] = useState<MenuViewMode>("cards");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await loadWorkspaceJson(STORAGE_KEY);
      let next: MenuViewMode = "cards";
      if (remote === "compact" || remote === "cards") {
        next = remote;
      } else if (!supabaseOnly) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw === "compact" || raw === "cards") {
            next = raw;
          }
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;
      if (!supabaseOnly) {
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
      }
      setModeState(next);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly]);

  const setMode = useCallback(
    (next: MenuViewMode) => {
      setModeState((prev) => {
        void persistWorkspaceState(STORAGE_KEY, next).then((ok) => {
          if (!ok) {
            setModeState(prev);
            failSave();
          } else if (!supabaseOnly) {
            try {
              localStorage.setItem(STORAGE_KEY, next);
            } catch {
              failSave();
            }
          }
        });
        return next;
      });
    },
    [failSave, supabaseOnly],
  );

  return { mode, setMode, ready };
}
