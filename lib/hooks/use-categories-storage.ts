"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CATEGORY_STORAGE_KEY,
  DEFAULT_CATEGORIES,
} from "@/lib/constants/categories";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  insertMenuCategory,
  loadMenuCategoriesRelational,
  menuRelationalPersistenceEnabled,
  reorderMenuCategoryRows,
  updateMenuCategoryRow,
} from "@/lib/supabase/menu-db";
import { migrateMenuCategoriesFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
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
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbMenu = menuRelationalPersistenceEnabled();

  const [categories, setCategories] = useState<MenuCategoryDefinition[]>(() =>
    DEFAULT_CATEGORIES.map(normalizeCategory),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (useDbMenu) {
      void (async () => {
        const rid = await getWorkspaceRestaurantId();
        if (rid) {
          await migrateMenuCategoriesFromLegacyAppStateIfEmpty(
            rid,
            DEFAULT_CATEGORIES.map(normalizeCategory),
          );
        }
        const rows = await loadMenuCategoriesRelational();
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setCategories(rows.map(normalizeCategory));
        } else {
          setCategories(DEFAULT_CATEGORIES.map(normalizeCategory));
        }
        setIsHydrated(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    if (supabaseOnly) {
      if (cancelled) return;
      setCategories(DEFAULT_CATEGORIES.map(normalizeCategory));
      setIsHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    const stored = loadFromStorage();
    const fromLocal = loadFromParsed(loadWorkspaceJsonLocal(CATEGORY_STORAGE_KEY));
    const next = fromLocal ?? stored;
    if (next?.length) {
      mirrorWorkspaceJsonLocal(
        CATEGORY_STORAGE_KEY,
        next.map(normalizeCategory),
      );
    }
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (cancelled) return;
      if (next && next.length > 0) {
        setCategories(next.map(normalizeCategory));
      }
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseOnly, useDbMenu]);

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
        setCategories((prev) => [...prev, normalizeCategory(row)]);
        toast.success("Kategorie angelegt");
        return { id: ins.id, name: trimmed };
      }
      return new Promise((resolve) => {
        setCategories((prev) => {
          const rollback = prev;
          const id = crypto.randomUUID();
          const next = [...prev, { id, name: trimmed, active }];
          const cleaned = next.map(normalizeCategory);
          const ok = mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, cleaned);
          if (!ok) {
            setCategories(rollback);
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
    [failSave, useDbMenu],
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
          setCategories((prev) =>
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
          toast.success("Kategorie gespeichert");
        })();
        return;
      }
      setCategories((prev) => {
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
          setCategories(rollback);
          failSave();
        } else {
          toast.success("Kategorie gespeichert");
        }
        return cleaned;
      });
    },
    [failSave, useDbMenu],
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
          setCategories(cleaned);
          toast.success("Kategorien sortiert");
        })();
        return;
      }
      setCategories((prev) => {
        const ok = mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, cleaned);
        if (!ok) {
          setCategories(prev);
          failSave();
        } else {
          toast.success("Kategorien sortiert");
        }
        return cleaned;
      });
    },
    [failSave, useDbMenu],
  );

  const getCategoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories],
  );

  return {
    categories,
    addCategory,
    updateCategory,
    reorderCategories,
    getCategoryById,
    isHydrated,
  };
}
