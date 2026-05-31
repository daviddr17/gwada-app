"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { mockMenu } from "@/lib/data/mock-menu";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { normalizeMenuItem } from "@/lib/menu/item-utils";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  deleteMenuItemRelational,
  insertMenuItemRelational,
  loadMenuItemsRelational,
  menuRelationalPersistenceEnabled,
  reorderMenuItemsInCategoryRelational,
  updateMenuItemRelational,
} from "@/lib/supabase/menu-db";
import { migrateMenuItemsFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import type { MenuItem, NewMenuItem } from "@/lib/types/menu";

const STORAGE_KEY = "gwada-menu-v1";

function loadFromStorage(): MenuItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const out: MenuItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const n = normalizeMenuItem(row as Record<string, unknown>);
      if (n) out.push(n);
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

function normalizeSeedItems(seed: MenuItem[]): MenuItem[] {
  return seed.map((row) => {
    const n = normalizeMenuItem({ ...row } as unknown as Record<string, unknown>);
    return n ?? row;
  });
}

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
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbMenu = menuRelationalPersistenceEnabled();

  const [items, setItems] = useState<MenuItem[]>(() =>
    supabaseOnly ? [] : normalizeSeedItems(mockMenu),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (useDbMenu) {
      void (async () => {
        const rid = await getWorkspaceRestaurantId();
        if (rid) {
          await migrateMenuItemsFromLegacyAppStateIfEmpty(rid);
        }
        const rows = await loadMenuItemsRelational();
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setItems(rows);
        } else {
          setItems([]);
        }
        setIsHydrated(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    if (supabaseOnly) {
      if (cancelled) return;
      setItems([]);
      setIsHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    const stored = loadFromStorage();
    const fromLocal = parseMenuItemsFromRemote(loadWorkspaceJsonLocal(STORAGE_KEY));
    const next = fromLocal ?? stored ?? normalizeSeedItems(mockMenu);
    try {
      mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (!cancelled) {
        setItems(next);
        setIsHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly, useDbMenu]);

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
        setItems((prev) => [newItem, ...prev]);
        toast.success("Gericht hinzugefügt");
        return newItem;
      }
      return new Promise((resolve) => {
        setItems((prev) => {
          const next = [newItem, ...prev];
          const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
          if (!ok) {
            setItems((p) => p.filter((i) => i.id !== newItem.id));
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
    [failSave, useDbMenu],
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
        setItems((prev) =>
          prev.map((existing) => (existing.id === id ? built : existing)),
        );
        toast.success("Gericht gespeichert");
        return true;
      }
      return new Promise((resolve) => {
        setItems((prev) => {
          const rollback = prev;
          const next = prev.map((existing) =>
            existing.id === id ? built : existing,
          );
          const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
          if (!ok) {
            setItems(rollback);
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
    [failSave, useDbMenu],
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
          setItems((prev) =>
            prev.map((item) => {
              if (item.category !== categoryId) return item;
              const pos = orderedIds.indexOf(item.id);
              if (pos === -1) return item;
              return { ...item, listNumber: pos + 1 };
            }),
          );
          toast.success("Reihenfolge der Gerichte aktualisiert");
        })();
        return;
      }
      setItems((prev) => {
        const rollback = prev;
        const next = prev.map((item) => {
          if (item.category !== categoryId) return item;
          const pos = orderedIds.indexOf(item.id);
          if (pos === -1) return item;
          return { ...item, listNumber: pos + 1 };
        });
        const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
        if (!ok) {
          setItems(rollback);
          failSave();
        } else {
          toast.success("Reihenfolge der Gerichte aktualisiert");
        }
        return next;
      });
    },
    [failSave, useDbMenu],
  );

  const deleteItem = useCallback(
    async (id: string): Promise<boolean> => {
      if (useDbMenu) {
        const ok = await deleteMenuItemRelational(id);
        if (!ok) {
          failSave();
          return false;
        }
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast.success("Gericht gelöscht");
        return true;
      }
      return new Promise((resolve) => {
        setItems((prev) => {
          const rollback = prev;
          const next = prev.filter((i) => i.id !== id);
          const ok = mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
          if (!ok) {
            setItems(rollback);
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
    [failSave, useDbMenu],
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
