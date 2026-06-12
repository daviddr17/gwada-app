"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CATEGORY_STORAGE_KEY } from "@/lib/constants/categories";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import {
  defaultMenuCategories,
  fetchMenuCategoriesForRestaurant,
  peekMenuCategoriesCache,
} from "@/lib/menu/menu-categories-query";
import { toastStorageError } from "@/lib/persist-notify";
import { invalidateMenuQueries } from "@/lib/query/module-query-invalidation";
import { queryKeys } from "@/lib/query/query-keys";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  deleteMenuCategory,
  insertMenuCategory,
  menuRelationalPersistenceEnabled,
  reorderMenuCategoryRows,
  updateMenuCategoryRow,
} from "@/lib/supabase/menu-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { MenuCategoryDefinition } from "@/lib/types/menu";

function normalizeCategory(c: MenuCategoryDefinition): MenuCategoryDefinition {
  return {
    ...c,
    active: c.active !== false,
  };
}

function isValidCategoryLoose(x: unknown): x is MenuCategoryDefinition {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || !o.name.trim()) {
    return false;
  }
  if (o.active !== undefined && typeof o.active !== "boolean") return false;
  return true;
}

function loadFromParsed(parsed: unknown): MenuCategoryDefinition[] | null {
  if (!Array.isArray(parsed) || !parsed.every(isValidCategoryLoose)) return null;
  return parsed.map(normalizeCategory);
}

function loadFromStorage(): MenuCategoryDefinition[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return loadFromParsed(parsed);
  } catch {
    return null;
  }
}

export function useCategoriesStorage() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbMenu = menuRelationalPersistenceEnabled();

  const [localCategories, setLocalCategories] = useState<MenuCategoryDefinition[]>(
    () => defaultMenuCategories(),
  );
  const [isLocalHydrated, setIsLocalHydrated] = useState(!useDbMenu);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.menu.categories(restaurantId ?? ""),
    queryFn: fetchMenuCategoriesForRestaurant,
    enabled: useDbMenu && workspaceReady && Boolean(restaurantId),
    staleTime: getModuleCacheStaleTime("menuModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("menuModule") ?? 5 * 60_000,
    placeholderData: (previous) =>
      previous ?? peekMenuCategoriesCache() ?? undefined,
  });

  const patchCategoriesCache = useCallback(
    (updater: (prev: MenuCategoryDefinition[]) => MenuCategoryDefinition[]) => {
      if (!restaurantId) return;
      queryClient.setQueryData<MenuCategoryDefinition[]>(
        queryKeys.menu.categories(restaurantId),
        (prev) => {
          const base = prev ?? defaultMenuCategories();
          const next = updater(base).map(normalizeCategory);
          mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, next);
          return next;
        },
      );
    },
    [queryClient, restaurantId],
  );

  const afterCategoryMutation = useCallback(() => {
    if (restaurantId) {
      invalidateMenuQueries(queryClient, restaurantId);
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
      setLocalCategories(defaultMenuCategories());
      setIsLocalHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    const fromLocal = loadFromParsed(loadWorkspaceJsonLocal(CATEGORY_STORAGE_KEY));
    const next = fromLocal ?? peekMenuCategoriesCache() ?? defaultMenuCategories();
    mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, next.map(normalizeCategory));
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (cancelled) return;
      setLocalCategories(next.map(normalizeCategory));
      setIsLocalHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly, useDbMenu]);

  const categories = useDbMenu
    ? (categoriesQuery.data ?? peekMenuCategoriesCache() ?? defaultMenuCategories())
    : localCategories;
  const isHydrated = useDbMenu
    ? workspaceReady &&
      (categoriesQuery.isSuccess ||
        categoriesQuery.isError ||
        Boolean(peekMenuCategoriesCache()?.length))
    : isLocalHydrated;

  const addCategory = useCallback(
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
        const ins = await insertMenuCategory(rid, trimmed, active);
        if (!ins) {
          failSave();
          return null;
        }
        const row: MenuCategoryDefinition = {
          id: ins.id,
          name: trimmed,
          active: active !== false,
        };
        patchCategoriesCache((prev) => [...prev, normalizeCategory(row)]);
        afterCategoryMutation();
        toast.success("Kategorie angelegt");
        return { id: ins.id, name: trimmed };
      }
      return new Promise((resolve) => {
        setLocalCategories((prev) => {
          const rollback = prev;
          const id = crypto.randomUUID();
          const next = [...prev, { id, name: trimmed, active }];
          const cleaned = next.map(normalizeCategory);
          const ok = mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, cleaned);
          if (!ok) {
            setLocalCategories(rollback);
            failSave();
            resolve(null);
          } else {
            toast.success("Kategorie angelegt");
            resolve({ id, name: trimmed });
          }
          return cleaned;
        });
      });
    },
    [afterCategoryMutation, failSave, patchCategoriesCache, useDbMenu],
  );

  const updateCategory = useCallback(
    (id: string, updates: { name?: string; active?: boolean }) => {
      if (useDbMenu) {
        void (async () => {
          const ok = await updateMenuCategoryRow(id, {
            name: updates.name,
            active: updates.active,
          });
          if (!ok) {
            failSave();
            return;
          }
          patchCategoriesCache((prev) =>
            prev.map((c) => {
              if (c.id !== id) return c;
              return normalizeCategory({
                ...c,
                ...updates,
                name:
                  updates.name !== undefined ? updates.name.trim() : c.name,
              });
            }),
          );
          afterCategoryMutation();
          toast.success("Kategorie gespeichert");
        })();
        return;
      }
      setLocalCategories((prev) => {
        const rollback = prev;
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          return normalizeCategory({
            ...c,
            ...updates,
            name: updates.name !== undefined ? updates.name.trim() : c.name,
          });
        });
        const cleaned = next.map(normalizeCategory);
        const ok = mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, cleaned);
        if (!ok) {
          setLocalCategories(rollback);
          failSave();
        } else {
          toast.success("Kategorie gespeichert");
        }
        return cleaned;
      });
    },
    [afterCategoryMutation, failSave, patchCategoriesCache, useDbMenu],
  );

  const reorderCategories = useCallback(
    (next: MenuCategoryDefinition[]) => {
      const cleaned = next.map(normalizeCategory);
      if (useDbMenu) {
        void (async () => {
          const ok = await reorderMenuCategoryRows(cleaned.map((c) => c.id));
          if (!ok) {
            failSave();
            return;
          }
          patchCategoriesCache(() => cleaned);
          afterCategoryMutation();
          toast.success("Kategorien sortiert");
        })();
        return;
      }
      setLocalCategories((prev) => {
        const ok = mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, cleaned);
        if (!ok) {
          setLocalCategories(prev);
          failSave();
        } else {
          toast.success("Kategorien sortiert");
        }
        return cleaned;
      });
    },
    [afterCategoryMutation, failSave, patchCategoriesCache, useDbMenu],
  );

  const getCategoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories],
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<boolean> => {
      if (useDbMenu) {
        const result = await deleteMenuCategory(id);
        if (result === "in_use") {
          toast.error("Kategorie wird noch von Gerichten verwendet.");
          return false;
        }
        if (result === "error") {
          failSave();
          return false;
        }
        patchCategoriesCache((prev) => prev.filter((c) => c.id !== id));
        afterCategoryMutation();
        toast.success("Kategorie gelöscht");
        return true;
      }
      let ok = false;
      setLocalCategories((prev) => {
        const next = prev.filter((c) => c.id !== id);
        ok = mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, next);
        if (!ok) {
          failSave();
          return prev;
        }
        toast.success("Kategorie gelöscht");
        return next;
      });
      return ok;
    },
    [afterCategoryMutation, failSave, patchCategoriesCache, useDbMenu],
  );

  return {
    categories,
    addCategory,
    updateCategory,
    reorderCategories,
    deleteCategory,
    getCategoryById,
    isHydrated,
  };
}
