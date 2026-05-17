"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  DEFAULT_DASHBOARD_WIDGET_VISIBILITY,
  normalizeWidgetOrder,
  reorderDashboardWidgetOrder,
  type DashboardWidgetId,
} from "@/lib/constants/dashboard-widgets";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  loadWorkspaceJson,
  persistWorkspaceState,
} from "@/lib/supabase/workspace-persistence";

export type DashboardWidgetPrefs = {
  visibility: Record<DashboardWidgetId, boolean>;
  order: DashboardWidgetId[];
};

function mergeVisibility(
  partial: Partial<Record<DashboardWidgetId, boolean>>,
): Record<DashboardWidgetId, boolean> {
  return { ...DEFAULT_DASHBOARD_WIDGET_VISIBILITY, ...partial };
}

function isLegacyFlatVisibility(
  parsed: Record<string, unknown>,
): parsed is Record<DashboardWidgetId, boolean> {
  const keys = Object.keys(parsed);
  if (keys.length === 0) return false;
  return keys.every(
    (k) =>
      k in DEFAULT_DASHBOARD_WIDGET_VISIBILITY &&
      typeof parsed[k] === "boolean",
  );
}

const defaultPrefs = (): DashboardWidgetPrefs => ({
  visibility: { ...DEFAULT_DASHBOARD_WIDGET_VISIBILITY },
  order: [...DEFAULT_DASHBOARD_WIDGET_ORDER],
});

function parseStored(raw: string | null): DashboardWidgetPrefs {
  const fallback = defaultPrefs();
  if (!raw?.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback;
    }
    const o = parsed as Record<string, unknown>;

    if (isLegacyFlatVisibility(o)) {
      return {
        visibility: mergeVisibility(o),
        order: [...DEFAULT_DASHBOARD_WIDGET_ORDER],
      };
    }

    const visRaw =
      o.visibility && typeof o.visibility === "object" && !Array.isArray(o.visibility)
        ? (o.visibility as Record<string, unknown>)
        : {};
    const patch: Partial<Record<DashboardWidgetId, boolean>> = {};
    for (const id of Object.keys(DEFAULT_DASHBOARD_WIDGET_VISIBILITY) as DashboardWidgetId[]) {
      if (typeof visRaw[id] === "boolean") patch[id] = visRaw[id] as boolean;
    }

    return {
      visibility: mergeVisibility(patch),
      order: normalizeWidgetOrder(o.order),
    };
  } catch {
    return fallback;
  }
}

function parseFromRemote(remote: unknown): DashboardWidgetPrefs | null {
  if (!remote || typeof remote !== "object" || Array.isArray(remote)) return null;
  return parseStored(JSON.stringify(remote));
}

export function useDashboardWidgetPreferences() {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [prefs, setPrefs] = useState<DashboardWidgetPrefs>(() => defaultPrefs());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (supabaseOnly) {
      void (async () => {
        const remote = await loadWorkspaceJson(DASHBOARD_WIDGET_STORAGE_KEY);
        if (cancelled) return;
        const p = parseFromRemote(remote) ?? defaultPrefs();
        setPrefs(p);
        setIsReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const remote = await loadWorkspaceJson(DASHBOARD_WIDGET_STORAGE_KEY);
      let raw: string | null = null;
      if (remote && typeof remote === "object" && !Array.isArray(remote)) {
        try {
          raw = JSON.stringify(remote);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(DASHBOARD_WIDGET_STORAGE_KEY, raw);
          }
        } catch {
          raw = null;
        }
      }
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          if (raw === null && typeof localStorage !== "undefined") {
            raw = localStorage.getItem(DASHBOARD_WIDGET_STORAGE_KEY);
          }
          setPrefs(parseStored(raw));
        } catch {
          setPrefs(defaultPrefs());
        }
        setIsReady(true);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly]);

  const setWidgetVisible = useCallback(
    (id: DashboardWidgetId, visible: boolean) => {
      setPrefs((p) => {
        const next: DashboardWidgetPrefs = {
          ...p,
          visibility: { ...p.visibility, [id]: visible },
        };
        void persistWorkspaceState(DASHBOARD_WIDGET_STORAGE_KEY, {
          visibility: next.visibility,
          order: next.order,
        }).then((ok) => {
          if (!ok) {
            setPrefs(p);
            failSave();
          }
        });
        return next;
      });
    },
    [failSave],
  );

  const reorderWidgets = useCallback(
    (dragId: DashboardWidgetId, dropId: DashboardWidgetId) => {
      setPrefs((p) => {
        const nextOrder = reorderDashboardWidgetOrder(p.order, dragId, dropId);
        const next: DashboardWidgetPrefs = { ...p, order: nextOrder };
        void persistWorkspaceState(DASHBOARD_WIDGET_STORAGE_KEY, {
          visibility: next.visibility,
          order: next.order,
        }).then((ok) => {
          if (!ok) {
            setPrefs(p);
            failSave();
          }
        });
        return next;
      });
    },
    [failSave],
  );

  return {
    visibility: prefs.visibility,
    order: prefs.order,
    setWidgetVisible,
    reorderWidgets,
    isReady,
  };
}
