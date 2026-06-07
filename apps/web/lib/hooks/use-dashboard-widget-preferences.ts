"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  DEFAULT_DASHBOARD_WIDGET_VISIBILITY,
  canonicalDashboardWidgetId,
  mergeDashboardWidgetVisibility,
  normalizeWidgetOrder,
  reorderDashboardWidgetOrder,
  visibilityPatchFromStored,
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
import { migrateDashboardWidgetsFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

export type { DashboardWidgetPrefs } from "@/lib/constants/dashboard-widgets";

function isLegacyFlatVisibility(parsed: Record<string, unknown>): boolean {
  const keys = Object.keys(parsed);
  if (keys.length === 0) return false;
  return keys.every(
    (k) =>
      canonicalDashboardWidgetId(k) != null && typeof parsed[k] === "boolean",
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
        visibility: mergeDashboardWidgetVisibility(visibilityPatchFromStored(o)),
        order: normalizeWidgetOrder(o.order ?? []),
      };
    }

    const visRaw =
      o.visibility && typeof o.visibility === "object" && !Array.isArray(o.visibility)
        ? (o.visibility as Record<string, unknown>)
        : {};

    return {
      visibility: mergeDashboardWidgetVisibility(visibilityPatchFromStored(visRaw)),
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
  const visRaw =
    row.visibility && typeof row.visibility === "object"
      ? (row.visibility as Record<string, unknown>)
      : {};
  return {
    visibility: mergeDashboardWidgetVisibility(visibilityPatchFromStored(visRaw)),
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
        let row = await loadUserRestaurantDashboardWidgets(
          profileId!,
          restaurantId!,
        );
        if (!row) {
          await migrateDashboardWidgetsFromLegacyAppStateIfEmpty(
            profileId!,
            restaurantId!,
          );
          row = await loadUserRestaurantDashboardWidgets(
            profileId!,
            restaurantId!,
          );
        }
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
        setPrefs(defaultPrefs());
        setIsReady(true);
        return;
      }

      if (supabaseOnly) {
        if (cancelled) return;
        setPrefs(defaultPrefs());
        setIsReady(true);
        return;
      }

      const fromLocal = parseFromRemote(
        loadWorkspaceJsonLocal(DASHBOARD_WIDGET_STORAGE_KEY),
      );
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        setPrefs(fromLocal ?? defaultPrefs());
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
        failSave();
        return;
      }

      const ok = mirrorWorkspaceJsonLocal(DASHBOARD_WIDGET_STORAGE_KEY, {
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
