"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import {
  getModuleCacheGcTime,
  getModuleCacheStaleTime,
} from "@/lib/dashboard/module-data-cache-policy";
import {
  defaultMenuSeedItems,
  fetchMenuItemsForRestaurant,
  MENU_ITEMS_STORAGE_KEY,
  peekMenuItemsCache,
} from "@/lib/menu/menu-items-query";
import { normalizeMenuItem } from "@/lib/menu/item-utils";
import { dispatchDashboardMenuLivePatchFromCache } from "@/lib/dashboard/dispatch-dashboard-menu-live-patch-from-cache";
import { toastStorageError } from "@/lib/persist-notify";
import { invalidateMenuQueries } from "@/lib/query/module-query-invalidation";
import { queryKeys } from "@/lib/query/query-keys";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  deleteMenuItemRelational,
  insertMenuItemRelational,
  menuRelationalPersistenceEnabled,
  reorderMenuItemsInCategoryRelational,
  updateMenuItemRelational,
} from "@/lib/supabase/menu-db";
import {
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { MenuItem, NewMenuItem } from "@/lib/types/menu";

const STORAGE_KEY = MENU_ITEMS_STORAGE_KEY;

function parseMenuItemsFromRemote(remote: unknown): MenuItem[] | null {
  if (!Array.isArray(remote)) return null;
  const out: MenuItem[] = [];
  for (const row of remote) {
    if (!row || typeof row !== "object") continue;
    const n = normalizeMenuItem(row as Record<string, unknown>);
    if (n) out.push(n);
  }
  return out.length ? out : null;
}

export function useMenuStorage() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbMenu = menuRelationalPersistenceEnabled();

  const [localItems, setLocalItems] = useState<MenuItem[]>(() =>
    supabaseOnly ? [] : defaultMenuSeedItems(),
  );
  const [isLocalHydrated, setIsLocalHydrated] = useState(!useDbMenu);

  const itemsQuery = useQuery({
    queryKey: queryKeys.menu.items(restaurantId ?? ""),
    queryFn: fetchMenuItemsForRestaurant,
    enabled: useDbMenu && workspaceReady && Boolean(restaurantId),
    staleTime: getModuleCacheStaleTime("menuModule") ?? 60_000,
    gcTime: getModuleCacheGcTime("menuModule") ?? 5 * 60_000,
    placeholderData: (previous) => previous ?? peekMenuItemsCache() ?? undefined,
  });

  const patchItemsCache = useCallback(
    (updater: (prev: MenuItem[]) => MenuItem[]) => {
      if (!restaurantId) return;
      const key = queryKeys.menu.items(restaurantId);
      queryClient.setQueryData<MenuItem[]>(key, (prev) => {
        const base = prev ?? [];
        const next = updater(base);
        mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
        return next;
      });
    },
    [queryClient, restaurantId],
  );

  const afterMenuMutation = useCallback(() => {
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
      setLocalItems([]);
      setIsLocalHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    const fromLocal = parseMenuItemsFromRemote(loadWorkspaceJsonLocal(STORAGE_KEY));
    const next = fromLocal ?? peekMenuItemsCache() ?? defaultMenuSeedItems();
    try {
      mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (!cancelled) {
        setLocalItems(next);
        setIsLocalHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly, useDbMenu]);

  const items = useDbMenu ? (itemsQuery.data ?? peekMenuItemsCache() ?? []) : localItems;
  const isHydrated = useDbMenu
    ? workspaceReady &&
      (itemsQuery.isSuccess ||
        itemsQuery.isError ||
        Boolean(peekMenuItemsCache()?.length))
    : isLocalHydrated;

  const addItem = useCallback(
    async (item: NewMenuItem): Promise<MenuItem | null> => {
      const newItem: MenuItem = {
        ...item,
        id: crypto.randomUUID(),
        active: item.active !== false,
        listNumber:
          item.listNumber != null && !Number.isNaN(item.listNumber)
            ? item.listNumber
            : null,
      };
      if (useDbMenu) {
        const ok = await insertMenuItemRelational(newItem);
        if (!ok) {
          failSave();
          return null;
        }
        patchItemsCache((prev) => [newItem, ...prev]);
        afterMenuMutation();
        toast.success("Gericht hinzugefügt");
        return newItem;
      }
      return new Promise((resolve) => {
        setLocalItems((prev) => {
          const next = [newItem, ...prev];
          const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
          if (!ok) {
            setLocalItems((p) => p.filter((i) => i.id !== newItem.id));
            failSave();
            resolve(null);
          } else {
            toast.success("Gericht hinzugefügt");
            resolve(newItem);
          }
          return next;
        });
      });
    },
    [afterMenuMutation, failSave, patchItemsCache, useDbMenu],
  );

  const updateItem = useCallback(
    async (id: string, item: NewMenuItem): Promise<boolean> => {
      const built: MenuItem = {
        ...item,
        id,
        active: item.active !== false,
        listNumber:
          item.listNumber != null && !Number.isNaN(item.listNumber)
            ? item.listNumber
            : null,
      };
      if (useDbMenu) {
        const ok = await updateMenuItemRelational(built);
        if (!ok) {
          failSave();
          return false;
        }
        patchItemsCache((prev) =>
          prev.map((existing) => (existing.id === id ? built : existing)),
        );
        afterMenuMutation();
        toast.success("Gericht gespeichert");
        return true;
      }
      return new Promise((resolve) => {
        setLocalItems((prev) => {
          const rollback = prev;
          const next = prev.map((existing) =>
            existing.id === id ? built : existing,
          );
          const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
          if (!ok) {
            setLocalItems(rollback);
            failSave();
            resolve(false);
          } else {
            toast.success("Gericht gespeichert");
            resolve(true);
          }
          return next;
        });
      });
    },
    [afterMenuMutation, failSave, patchItemsCache, useDbMenu],
  );

  const getItemById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items],
  );

  const reorderItemsInCategory = useCallback(
    (categoryId: string, orderedIds: string[]) => {
      if (useDbMenu) {
        void (async () => {
          const ok = await reorderMenuItemsInCategoryRelational(
            categoryId,
            orderedIds,
          );
          if (!ok) {
            failSave();
            return;
          }
          patchItemsCache((prev) =>
            prev.map((item) => {
              if (item.category !== categoryId) return item;
              const pos = orderedIds.indexOf(item.id);
              if (pos === -1) return item;
              return { ...item, listNumber: pos + 1 };
            }),
          );
          afterMenuMutation();
          toast.success("Reihenfolge der Gerichte aktualisiert");
        })();
        return;
      }
      setLocalItems((prev) => {
        const rollback = prev;
        const next = prev.map((item) => {
          if (item.category !== categoryId) return item;
          const pos = orderedIds.indexOf(item.id);
          if (pos === -1) return item;
          return { ...item, listNumber: pos + 1 };
        });
        const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
        if (!ok) {
          setLocalItems(rollback);
          failSave();
        } else {
          toast.success("Reihenfolge der Gerichte aktualisiert");
        }
        return next;
      });
    },
    [afterMenuMutation, failSave, patchItemsCache, useDbMenu],
  );

  const deleteItem = useCallback(
    async (id: string): Promise<boolean> => {
      if (useDbMenu) {
        const ok = await deleteMenuItemRelational(id);
        if (!ok) {
          failSave();
          return false;
        }
        patchItemsCache((prev) => prev.filter((i) => i.id !== id));
        afterMenuMutation();
        toast.success("Gericht gelöscht");
        return true;
      }
      return new Promise((resolve) => {
        setLocalItems((prev) => {
          const rollback = prev;
          const next = prev.filter((i) => i.id !== id);
          const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
          if (!ok) {
            setLocalItems(rollback);
            failSave();
            resolve(false);
          } else {
            toast.success("Gericht gelöscht");
            resolve(true);
          }
          return next;
        });
      });
    },
    [afterMenuMutation, failSave, patchItemsCache, useDbMenu],
  );

  return {
    items,
    addItem,
    updateItem,
    deleteItem,
    getItemById,
    reorderItemsInCategory,
    isHydrated,
  };
}
