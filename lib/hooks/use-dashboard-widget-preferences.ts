"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  DEFAULT_DASHBOARD_WIDGET_VISIBILITY,
  normalizeWidgetOrder,
  reorderDashboardWidgetOrder,
  type DashboardWidgetId,
  type DashboardWidgetPrefs,
} from "@/lib/constants/dashboard-widgets";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  loadUserRestaurantDashboardWidgets,
  upsertUserRestaurantDashboardWidgets,
  type RawDashboardWidgetRow,
} from "@/lib/supabase/user-restaurant-dashboard-widgets";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  getWorkspaceRestaurantId,
  loadWorkspaceJson,
  persistWorkspaceState,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

export type { DashboardWidgetPrefs } from "@/lib/constants/dashboard-widgets";

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

function localCompositeKey(profileId: string, restaurantId: string): string {
  return `${DASHBOARD_WIDGET_STORAGE_KEY}:user:${profileId}:restaurant:${restaurantId}`;
}

function normalizeDbRow(row: RawDashboardWidgetRow): DashboardWidgetPrefs {
  const patch: Partial<Record<DashboardWidgetId, boolean>> = {};
  for (const id of Object.keys(DEFAULT_DASHBOARD_WIDGET_VISIBILITY) as DashboardWidgetId[]) {
    if (typeof row.visibility[id] === "boolean") patch[id] = row.visibility[id] as boolean;
  }
  return {
    visibility: mergeVisibility(patch),
    order: normalizeWidgetOrder(row.order),
  };
}

async function resolveUserAndRestaurant(): Promise<{
  profileId: string | null;
  restaurantId: string | null;
}> {
  if (!workspacePersistenceConfigured()) {
    return { profileId: null, restaurantId: null };
  }
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const restaurantId = await getWorkspaceRestaurantId();
  return { profileId: user?.id ?? null, restaurantId };
}

export function useDashboardWidgetPreferences() {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [prefs, setPrefs] = useState<DashboardWidgetPrefs>(() => defaultPrefs());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { profileId, restaurantId } = await resolveUserAndRestaurant();
      if (cancelled) return;

      const useUserRestaurantDb =
        Boolean(profileId && restaurantId) && workspacePersistenceConfigured();

      if (useUserRestaurantDb) {
        const row = await loadUserRestaurantDashboardWidgets(
          profileId!,
          restaurantId!,
        );
        if (cancelled) return;
        if (row) {
          setPrefs(normalizeDbRow(row));
          setIsReady(true);
          return;
        }
        try {
          const composite =
            typeof localStorage !== "undefined"
              ? localStorage.getItem(localCompositeKey(profileId!, restaurantId!))
              : null;
          if (composite) {
            setPrefs(parseStored(composite));
            setIsReady(true);
            return;
          }
        } catch {
          /* ignore */
        }
        const legacyRemote = await loadWorkspaceJson(DASHBOARD_WIDGET_STORAGE_KEY);
        if (cancelled) return;
        const fromLegacy = parseFromRemote(legacyRemote);
        if (fromLegacy) {
          setPrefs(fromLegacy);
          setIsReady(true);
          return;
        }
        setPrefs(defaultPrefs());
        setIsReady(true);
        return;
      }

      if (supabaseOnly) {
        const remote = await loadWorkspaceJson(DASHBOARD_WIDGET_STORAGE_KEY);
        if (cancelled) return;
        const p = parseFromRemote(remote) ?? defaultPrefs();
        setPrefs(p);
        setIsReady(true);
        return;
      }

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
    };

    void load();
    const onWorkspaceRestaurant = () => {
      void load();
    };
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onWorkspaceRestaurant,
    );
    return () => {
      cancelled = true;
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onWorkspaceRestaurant,
      );
    };
  }, [supabaseOnly]);

  const persistPrefs = useCallback(
    async (next: DashboardWidgetPrefs, previous: DashboardWidgetPrefs) => {
      const { profileId, restaurantId } = await resolveUserAndRestaurant();
      const useUserRestaurantDb =
        Boolean(profileId && restaurantId) && workspacePersistenceConfigured();

      if (useUserRestaurantDb) {
        const ok = await upsertUserRestaurantDashboardWidgets(
          profileId!,
          restaurantId!,
          next,
        );
        if (!ok) {
          setPrefs(previous);
          failSave();
          return;
        }
        if (!supabaseOnly) {
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(
                localCompositeKey(profileId!, restaurantId!),
                JSON.stringify({ visibility: next.visibility, order: next.order }),
              );
            }
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (supabaseOnly) {
        const ok = await persistWorkspaceState(DASHBOARD_WIDGET_STORAGE_KEY, {
          visibility: next.visibility,
          order: next.order,
        });
        if (!ok) {
          setPrefs(previous);
          failSave();
        }
        return;
      }
      const ok = await persistWorkspaceState(DASHBOARD_WIDGET_STORAGE_KEY, {
        visibility: next.visibility,
        order: next.order,
      });
      if (!ok) {
        setPrefs(previous);
        failSave();
      }
    },
    [failSave, supabaseOnly],
  );

  const setWidgetVisible = useCallback(
    (id: DashboardWidgetId, visible: boolean) => {
      setPrefs((p) => {
        const next: DashboardWidgetPrefs = {
          ...p,
          visibility: { ...p.visibility, [id]: visible },
        };
        void persistPrefs(next, p);
        return next;
      });
    },
    [persistPrefs],
  );

  const reorderWidgets = useCallback(
    (dragId: DashboardWidgetId, dropId: DashboardWidgetId) => {
      setPrefs((p) => {
        const nextOrder = reorderDashboardWidgetOrder(p.order, dragId, dropId);
        const next: DashboardWidgetPrefs = { ...p, order: nextOrder };
        void persistPrefs(next, p);
        return next;
      });
    },
    [persistPrefs],
  );

  return {
    visibility: prefs.visibility,
    order: prefs.order,
    setWidgetVisible,
    reorderWidgets,
    isReady,
  };
}
