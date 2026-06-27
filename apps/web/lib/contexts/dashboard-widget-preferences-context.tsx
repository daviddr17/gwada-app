"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  countDashboardVisibleShortcuts,
  DASHBOARD_FAB_MAX_SHORTCUTS,
  reorderDashboardShortcutOrder,
  type DashboardShortcutId,
} from "@/lib/constants/dashboard-shortcuts";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  defaultDashboardWidgetPrefs,
  reorderDashboardWidgetOrder,
  type DashboardWidgetId,
  type DashboardWidgetPrefs,
} from "@/lib/constants/dashboard-widgets";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import {
  dashboardWidgetPrefsLocalCompositeKey,
  normalizeDbDashboardWidgetRow,
  parseStoredDashboardWidgetPrefs,
  peekOptimisticDashboardWidgetPrefs,
  resolveDashboardWidgetUserAndRestaurant,
} from "@/lib/dashboard/dashboard-widget-prefs-client";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import { migrateDashboardWidgetsFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import {
  loadUserRestaurantDashboardWidgets,
  upsertUserRestaurantDashboardWidgets,
} from "@/lib/supabase/user-restaurant-dashboard-widgets";
import {
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

export type DashboardWidgetPreferencesValue = {
  visibility: DashboardWidgetPrefs["visibility"];
  order: DashboardWidgetPrefs["order"];
  shortcuts: DashboardWidgetPrefs["shortcuts"];
  setWidgetVisible: (id: DashboardWidgetId, visible: boolean) => void;
  reorderWidgets: (dragId: DashboardWidgetId, dropId: DashboardWidgetId) => void;
  setShortcutVisible: (id: DashboardShortcutId, visible: boolean) => void;
  reorderShortcuts: (dragId: DashboardShortcutId, dropId: DashboardShortcutId) => void;
  /** True sobald initiale Prefs verfügbar sind (optimistisch aus Cache oder Defaults). */
  isReady: boolean;
  /** True nach erstem Remote-Reconcile (DB / Workspace-JSON). */
  isReconciled: boolean;
};

export const DashboardWidgetPreferencesContext =
  createContext<DashboardWidgetPreferencesValue | null>(null);

function parseFromWorkspaceLocal(): DashboardWidgetPrefs | null {
  const remote = loadWorkspaceJsonLocal(DASHBOARD_WIDGET_STORAGE_KEY);
  if (!remote || typeof remote !== "object" || Array.isArray(remote)) return null;
  return parseStoredDashboardWidgetPrefs(JSON.stringify(remote));
}

/**
 * Shared state — einmal pro Provider-Mount (Dashboard-Home) oder standalone (Einstellungen).
 * Cache-Strategie: optimistic local → Remote-Reconcile (später erweiterbar pro Modul).
 */
export function useDashboardWidgetPreferencesState(): DashboardWidgetPreferencesValue {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

  const [prefs, setPrefs] = useState<DashboardWidgetPrefs>(
    defaultDashboardWidgetPrefs,
  );
  const [isReady, setIsReady] = useState(true);
  const [isReconciled, setIsReconciled] = useState(false);

  useLayoutEffect(() => {
    const optimistic = peekOptimisticDashboardWidgetPrefs();
    if (optimistic) setPrefs(optimistic);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const reconcile = async () => {
      const { profileId, restaurantId } =
        await resolveDashboardWidgetUserAndRestaurant();
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
          setPrefs(normalizeDbDashboardWidgetRow(row));
          setIsReady(true);
          setIsReconciled(true);
          return;
        }
        try {
          const composite =
            typeof localStorage !== "undefined"
              ? localStorage.getItem(
                  dashboardWidgetPrefsLocalCompositeKey(profileId!, restaurantId!),
                )
              : null;
          if (composite) {
            setPrefs(parseStoredDashboardWidgetPrefs(composite));
            setIsReady(true);
            setIsReconciled(true);
            return;
          }
        } catch {
          /* ignore */
        }
        setPrefs(defaultDashboardWidgetPrefs());
        setIsReady(true);
        setIsReconciled(true);
        return;
      }

      if (supabaseOnly) {
        if (cancelled) return;
        setPrefs(defaultDashboardWidgetPrefs());
        setIsReady(true);
        setIsReconciled(true);
        return;
      }

      const fromLocal = parseFromWorkspaceLocal();
      if (cancelled) return;
      setPrefs(fromLocal ?? defaultDashboardWidgetPrefs());
      setIsReady(true);
      setIsReconciled(true);
    };

    void reconcile();
    const onWorkspaceRestaurant = () => {
      void reconcile();
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
      const { profileId, restaurantId } =
        await resolveDashboardWidgetUserAndRestaurant();
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
                dashboardWidgetPrefsLocalCompositeKey(profileId!, restaurantId!),
                JSON.stringify({
                  visibility: next.visibility,
                  order: next.order,
                  shortcuts: next.shortcuts,
                }),
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
        shortcuts: next.shortcuts,
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

  const setShortcutVisible = useCallback(
    (id: DashboardShortcutId, visible: boolean) => {
      setPrefs((p) => {
        if (
          visible &&
          !p.shortcuts.visibility[id] &&
          countDashboardVisibleShortcuts(p.shortcuts.visibility) >=
            DASHBOARD_FAB_MAX_SHORTCUTS
        ) {
          return p;
        }
        const next: DashboardWidgetPrefs = {
          ...p,
          shortcuts: {
            ...p.shortcuts,
            visibility: { ...p.shortcuts.visibility, [id]: visible },
          },
        };
        void persistPrefs(next, p);
        return next;
      });
    },
    [persistPrefs],
  );

  const reorderShortcuts = useCallback(
    (dragId: DashboardShortcutId, dropId: DashboardShortcutId) => {
      setPrefs((p) => {
        const nextOrder = reorderDashboardShortcutOrder(
          p.shortcuts.order,
          dragId,
          dropId,
        );
        const next: DashboardWidgetPrefs = {
          ...p,
          shortcuts: { ...p.shortcuts, order: nextOrder },
        };
        void persistPrefs(next, p);
        return next;
      });
    },
    [persistPrefs],
  );

  return useMemo(
    () => ({
      visibility: prefs.visibility,
      order: prefs.order,
      shortcuts: prefs.shortcuts,
      setWidgetVisible,
      reorderWidgets,
      setShortcutVisible,
      reorderShortcuts,
      isReady,
      isReconciled,
    }),
    [
      prefs.visibility,
      prefs.order,
      prefs.shortcuts,
      setWidgetVisible,
      reorderWidgets,
      setShortcutVisible,
      reorderShortcuts,
      isReady,
      isReconciled,
    ],
  );
}

export function DashboardWidgetPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useDashboardWidgetPreferencesState();
  return (
    <DashboardWidgetPreferencesContext.Provider value={value}>
      {children}
    </DashboardWidgetPreferencesContext.Provider>
  );
}

export function useDashboardWidgetPreferencesContext(): DashboardWidgetPreferencesValue {
  const ctx = useContext(DashboardWidgetPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useDashboardWidgetPreferencesContext muss innerhalb von DashboardWidgetPreferencesProvider verwendet werden.",
    );
  }
  return ctx;
}
