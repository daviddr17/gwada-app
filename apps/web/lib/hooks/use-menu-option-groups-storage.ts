"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  deleteMenuOptionGroupRelational,
  insertMenuOptionGroupRelational,
  loadMenuOptionGroupsRelational,
  menuRelationalPersistenceEnabled,
  reorderMenuOptionGroupsRelational,
  updateMenuOptionGroupRelational,
  type MenuOptionGroupSaveInput,
} from "@/lib/supabase/menu-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import type { MenuOptionGroup } from "@/lib/types/menu";

const STORAGE_KEY = "gwada.menu.optionGroups";

function normalizeGroup(g: MenuOptionGroup): MenuOptionGroup {
  return {
    ...g,
    active: g.active !== false,
    minSelect: Math.max(0, g.minSelect ?? 0),
    maxSelect: g.maxSelect == null ? null : Math.max(1, g.maxSelect),
    choices: (g.choices ?? []).map((c) => ({
      ...c,
      active: c.active !== false,
      priceDelta: Number.isFinite(c.priceDelta) ? Math.max(0, c.priceDelta) : 0,
    })),
  };
}

function isValidLoose(x: unknown): x is MenuOptionGroup {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    o.name.trim().length > 0 &&
    Array.isArray(o.choices)
  );
}

export function useMenuOptionGroupsStorage() {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDb = menuRelationalPersistenceEnabled();

  const [items, setItems] = useState<MenuOptionGroup[]>([]);
  const [isHydrated, setIsHydrated] = useState(!useDb);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    if (useDb) {
      const localRaw = loadWorkspaceJsonLocal(STORAGE_KEY);
      if (Array.isArray(localRaw) && localRaw.every(isValidLoose)) {
        setItems(localRaw.map(normalizeGroup));
      }
      setIsHydrated(true);

      void (async () => {
        const rid = await getWorkspaceRestaurantId();
        const rows = await loadMenuOptionGroupsRelational(rid);
        if (cancelled) return;
        if (rows) {
          const next = rows.map(normalizeGroup);
          setItems(next);
          mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
        }
      })();
    } else {
      const localRaw = loadWorkspaceJsonLocal(STORAGE_KEY);
      if (Array.isArray(localRaw) && localRaw.every(isValidLoose)) {
        setItems(localRaw.map(normalizeGroup));
      }
      setIsHydrated(true);
    }

    return () => {
      cancelled = true;
    };
  }, [useDb]);

  const persistLocal = useCallback((next: MenuOptionGroup[]) => {
    setItems(next);
    mirrorWorkspaceJsonLocal(STORAGE_KEY, next);
  }, []);

  const add = useCallback(
    async (input: MenuOptionGroupSaveInput): Promise<string | null> => {
      if (useDb) {
        const rid = await getWorkspaceRestaurantId();
        if (!rid) {
          failSave();
          return null;
        }
        const created = await insertMenuOptionGroupRelational(rid, input);
        if (!created) {
          failSave();
          return null;
        }
        const rows = await loadMenuOptionGroupsRelational(rid);
        if (rows) persistLocal(rows.map(normalizeGroup));
        toast.success("Option angelegt");
        return created.id;
      }
      const id = crypto.randomUUID();
      const group = normalizeGroup({
        id,
        name: input.name,
        active: input.active,
        minSelect: input.minSelect,
        maxSelect: input.maxSelect,
        choices: input.choices.map((c) => ({
          id: c.id ?? crypto.randomUUID(),
          name: c.name,
          priceDelta: c.priceDelta,
          active: c.active,
        })),
      });
      persistLocal([...items, group]);
      toast.success("Option angelegt");
      return id;
    },
    [useDb, failSave, persistLocal, items],
  );

  const update = useCallback(
    async (id: string, input: MenuOptionGroupSaveInput): Promise<boolean> => {
      if (useDb) {
        const ok = await updateMenuOptionGroupRelational(id, input);
        if (!ok) {
          failSave();
          return false;
        }
        const rid = await getWorkspaceRestaurantId();
        const rows = await loadMenuOptionGroupsRelational(rid);
        if (rows) persistLocal(rows.map(normalizeGroup));
        toast.success("Option gespeichert");
        return true;
      }
      persistLocal(
        items.map((g) =>
          g.id === id
            ? normalizeGroup({
                id,
                name: input.name,
                active: input.active,
                minSelect: input.minSelect,
                maxSelect: input.maxSelect,
                choices: input.choices.map((c) => ({
                  id: c.id ?? crypto.randomUUID(),
                  name: c.name,
                  priceDelta: c.priceDelta,
                  active: c.active,
                })),
              })
            : g,
        ),
      );
      toast.success("Option gespeichert");
      return true;
    },
    [useDb, failSave, persistLocal, items],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (useDb) {
        const ok = await deleteMenuOptionGroupRelational(id);
        if (!ok) {
          failSave();
          return false;
        }
        persistLocal(items.filter((g) => g.id !== id));
        toast.success("Option gelöscht");
        return true;
      }
      persistLocal(items.filter((g) => g.id !== id));
      toast.success("Option gelöscht");
      return true;
    },
    [useDb, failSave, persistLocal, items],
  );

  const reorder = useCallback(
    async (ordered: { id: string; active?: boolean }[]) => {
      const byId = new Map(items.map((g) => [g.id, g]));
      const next = ordered
        .map((row) => {
          const g = byId.get(row.id);
          if (!g) return null;
          return normalizeGroup({
            ...g,
            active: row.active !== undefined ? row.active : g.active,
          });
        })
        .filter((g): g is MenuOptionGroup => g != null);

      if (useDb) {
        const ok = await reorderMenuOptionGroupsRelational(next.map((g) => g.id));
        if (!ok) {
          failSave();
          return;
        }
        // Persist active toggles from manage list
        for (const g of next) {
          const prev = byId.get(g.id);
          if (prev && prev.active !== g.active) {
            await updateMenuOptionGroupRelational(g.id, {
              name: g.name,
              active: g.active !== false,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
              choices: g.choices.map((c) => ({
                id: c.id,
                name: c.name,
                priceDelta: c.priceDelta,
                active: c.active !== false,
              })),
            });
          }
        }
        const rid = await getWorkspaceRestaurantId();
        const rows = await loadMenuOptionGroupsRelational(rid);
        if (rows) {
          persistLocal(rows.map(normalizeGroup));
          return;
        }
      }
      persistLocal(next);
    },
    [items, useDb, failSave, persistLocal],
  );

  const getById = useCallback(
    (id: string) => items.find((g) => g.id === id) ?? null,
    [items],
  );

  return {
    items,
    isHydrated,
    add,
    update,
    remove,
    reorder,
    getById,
  };
}
