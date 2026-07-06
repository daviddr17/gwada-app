"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MAIN_CATEGORY_STORAGE_KEY } from "@/lib/constants/main-categories";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import {
  defaultMenuMainCategories,
  fetchMenuMainCategoriesForRestaurant,
  peekMenuMainCategoriesCache,
} from "@/lib/menu/menu-main-categories-query";
import { toastStorageError } from "@/lib/persist-notify";
import { dispatchDashboardMenuLivePatchFromCache } from "@/lib/dashboard/dispatch-dashboard-menu-live-patch-from-cache";
import { invalidateMenuQueries } from "@/lib/query/module-query-invalidation";
import { queryKeys } from "@/lib/query/query-keys";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  deleteMenuMainCategory,
  insertMenuMainCategory,
  menuRelationalPersistenceEnabled,
  reorderMenuMainCategoryRows,
  updateMenuMainCategoryRow,
} from "@/lib/supabase/menu-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { MenuMainCategoryDefinition } from "@/lib/types/menu";

function normalizeMainCategory(
  c: MenuMainCategoryDefinition,
): MenuMainCategoryDefinition {
  return {
    ...c,
    active: c.active !== false,
  };
}

function isValidMainCategoryLoose(x: unknown): x is MenuMainCategoryDefinition {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || !o.name.trim()) {
    return false;
  }
  if (o.active !== undefined && typeof o.active !== "boolean") return false;
  return true;
}

function loadFromParsed(parsed: unknown): MenuMainCategoryDefinition[] | null {
  if (!Array.isArray(parsed) || !parsed.every(isValidMainCategoryLoose)) {
    return null;
  }
  return parsed.map(normalizeMainCategory);
}

export function useMainCategoriesStorage() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbMenu = menuRelationalPersistenceEnabled();

  const [localMainCategories, setLocalMainCategories] = useState<
    MenuMainCategoryDefinition[]
  >(() => defaultMenuMainCategories());
  const [isLocalHydrated, setIsLocalHydrated] = useState(!useDbMenu);

  const mainCategoriesQuery = useQuery({
    queryKey: queryKeys.menu.mainCategories(restaurantId ?? ""),
    queryFn: fetchMenuMainCategoriesForRestaurant,
    enabled: useDbMenu && workspaceReady && Boolean(restaurantId),
    staleTime: getModuleCacheStaleTime("menuModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("menuModule") ?? 5 * 60_000,
    placeholderData: (previous) =>
      previous ?? peekMenuMainCategoriesCache() ?? undefined,
  });

  const patchMainCategoriesCache = useCallback(
    (
      updater: (
        prev: MenuMainCategoryDefinition[],
      ) => MenuMainCategoryDefinition[],
    ) => {
      if (!restaurantId) return;
      queryClient.setQueryData<MenuMainCategoryDefinition[]>(
        queryKeys.menu.mainCategories(restaurantId),
        (prev) => {
          const base = prev ?? defaultMenuMainCategories();
          const next = updater(base).map(normalizeMainCategory);
          mirrorWorkspaceJsonLocal(MAIN_CATEGORY_STORAGE_KEY, next);
          return next;
        },
      );
    },
    [queryClient, restaurantId],
  );

  const afterMainCategoryMutation = useCallback(() => {
    if (restaurantId) {
      invalidateMenuQueries(queryClient, restaurantId);
      dispatchDashboardMenuLivePatchFromCache(restaurantId);
    }
  }, [queryClient, restaurantId]);

  useEffect(() => {
    let cancelled = false;
    if (useDbMenu) {
      return () => {
        cancelled = true;
      };
    }

    if (supabaseOnly) {
      if (cancelled) return;
      setLocalMainCategories(defaultMenuMainCategories());
      setIsLocalHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    const fromLocal = loadFromParsed(
      loadWorkspaceJsonLocal(MAIN_CATEGORY_STORAGE_KEY),
    );
    const next =
      fromLocal ?? peekMenuMainCategoriesCache() ?? defaultMenuMainCategories();
    mirrorWorkspaceJsonLocal(
      MAIN_CATEGORY_STORAGE_KEY,
      next.map(normalizeMainCategory),
    );
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (cancelled) return;
      setLocalMainCategories(next.map(normalizeMainCategory));
      setIsLocalHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly, useDbMenu]);

  const mainCategories = useDbMenu
    ? (mainCategoriesQuery.data ??
      peekMenuMainCategoriesCache() ??
      defaultMenuMainCategories())
    : localMainCategories;
  const isHydrated = useDbMenu
    ? workspaceReady &&
      (mainCategoriesQuery.isSuccess ||
        mainCategoriesQuery.isError ||
        Boolean(peekMenuMainCategoriesCache()?.length))
    : isLocalHydrated;

  const addMainCategory = useCallback(
    async (
      name: string,
      active = true,
    ): Promise<{ id: string; name: string } | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      if (useDbMenu) {
        const rid = await getWorkspaceRestaurantId();
        if (!rid) {
          failSave();
          return null;
        }
        const ins = await insertMenuMainCategory(rid, trimmed, active);
        if (!ins) {
          failSave();
          return null;
        }
        const row: MenuMainCategoryDefinition = {
          id: ins.id,
          name: trimmed,
          active: active !== false,
        };
        patchMainCategoriesCache((prev) => [...prev, normalizeMainCategory(row)]);
        afterMainCategoryMutation();
        toast.success("Hauptkategorie angelegt");
        return { id: ins.id, name: trimmed };
      }
      return new Promise((resolve) => {
        setLocalMainCategories((prev) => {
          const rollback = prev;
          const id = crypto.randomUUID();
          const next = [...prev, { id, name: trimmed, active }];
          const cleaned = next.map(normalizeMainCategory);
          const ok = mirrorWorkspaceJsonLocal(MAIN_CATEGORY_STORAGE_KEY, cleaned);
          if (!ok) {
            setLocalMainCategories(rollback);
            failSave();
            resolve(null);
          } else {
            toast.success("Hauptkategorie angelegt");
            resolve({ id, name: trimmed });
          }
          return cleaned;
        });
      });
    },
    [afterMainCategoryMutation, failSave, patchMainCategoriesCache, useDbMenu],
  );

  const updateMainCategory = useCallback(
    (id: string, updates: { name?: string; active?: boolean }) => {
      if (useDbMenu) {
        void (async () => {
          const ok = await updateMenuMainCategoryRow(id, {
            name: updates.name,
            active: updates.active,
          });
          if (!ok) {
            failSave();
            return;
          }
          patchMainCategoriesCache((prev) =>
            prev.map((c) => {
              if (c.id !== id) return c;
              return normalizeMainCategory({
                ...c,
                ...updates,
                name:
                  updates.name !== undefined ? updates.name.trim() : c.name,
              });
            }),
          );
          afterMainCategoryMutation();
          toast.success("Hauptkategorie gespeichert");
        })();
        return;
      }
      setLocalMainCategories((prev) => {
        const rollback = prev;
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          return normalizeMainCategory({
            ...c,
            ...updates,
            name: updates.name !== undefined ? updates.name.trim() : c.name,
          });
        });
        const cleaned = next.map(normalizeMainCategory);
        const ok = mirrorWorkspaceJsonLocal(MAIN_CATEGORY_STORAGE_KEY, cleaned);
        if (!ok) {
          setLocalMainCategories(rollback);
          failSave();
        } else {
          toast.success("Hauptkategorie gespeichert");
        }
        return cleaned;
      });
    },
    [afterMainCategoryMutation, failSave, patchMainCategoriesCache, useDbMenu],
  );

  const reorderMainCategories = useCallback(
    (next: MenuMainCategoryDefinition[]) => {
      const cleaned = next.map(normalizeMainCategory);
      if (useDbMenu) {
        void (async () => {
          const ok = await reorderMenuMainCategoryRows(cleaned.map((c) => c.id));
          if (!ok) {
            failSave();
            return;
          }
          patchMainCategoriesCache(() => cleaned);
          afterMainCategoryMutation();
          toast.success("Hauptkategorien sortiert");
        })();
        return;
      }
      setLocalMainCategories((prev) => {
        const ok = mirrorWorkspaceJsonLocal(MAIN_CATEGORY_STORAGE_KEY, cleaned);
        if (!ok) {
          setLocalMainCategories(prev);
          failSave();
        } else {
          toast.success("Hauptkategorien sortiert");
        }
        return cleaned;
      });
    },
    [afterMainCategoryMutation, failSave, patchMainCategoriesCache, useDbMenu],
  );

  const deleteMainCategory = useCallback(
    async (id: string): Promise<boolean> => {
      if (useDbMenu) {
        const result = await deleteMenuMainCategory(id);
        if (result === "in_use") {
          toast.error(
            "Hauptkategorie wird noch von Kategorien verwendet.",
          );
          return false;
        }
        if (result === "error") {
          failSave();
          return false;
        }
        patchMainCategoriesCache((prev) => prev.filter((c) => c.id !== id));
        afterMainCategoryMutation();
        toast.success("Hauptkategorie gelöscht");
        return true;
      }
      let ok = false;
      setLocalMainCategories((prev) => {
        const next = prev.filter((c) => c.id !== id);
        ok = mirrorWorkspaceJsonLocal(MAIN_CATEGORY_STORAGE_KEY, next);
        if (!ok) {
          failSave();
          return prev;
        }
        toast.success("Hauptkategorie gelöscht");
        return next;
      });
      return ok;
    },
    [afterMainCategoryMutation, failSave, patchMainCategoriesCache, useDbMenu],
  );

  const getMainCategoryById = useCallback(
    (id: string) => mainCategories.find((c) => c.id === id),
    [mainCategories],
  );

  return {
    mainCategories,
    addMainCategory,
    updateMainCategory,
    reorderMainCategories,
    deleteMainCategory,
    getMainCategoryById,
    isHydrated,
  };
}
