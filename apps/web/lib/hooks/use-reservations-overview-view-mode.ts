"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";

export type ReservationsOverviewViewMode = "standard" | "compact";

export const RESERVATIONS_OVERVIEW_VIEW_MODE_KEY =
  "gwada-reservations-overview-view-mode";

function parseReservationsOverviewViewMode(
  raw: unknown,
): ReservationsOverviewViewMode {
  return raw === "compact" ? "compact" : "standard";
}

export function useReservationsOverviewViewMode() {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [mode, setModeState] =
    useState<ReservationsOverviewViewMode>("standard");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const next = parseReservationsOverviewViewMode(
      loadWorkspaceJsonLocal(RESERVATIONS_OVERVIEW_VIEW_MODE_KEY),
    );
    if (cancelled) return;
    setModeState(next);
    setReady(true);
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback(
    (next: ReservationsOverviewViewMode) => {
      const ok = mirrorWorkspaceJsonLocal(
        RESERVATIONS_OVERVIEW_VIEW_MODE_KEY,
        next,
      );
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
