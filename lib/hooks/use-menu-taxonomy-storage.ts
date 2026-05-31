"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MENU_TAXONOMY_ALLERGENS_KEY,
  MENU_TAXONOMY_TAGS_KEY,
} from "@/lib/constants/menu-taxonomy-storage";
import type { MenuTaxonomyDefinition } from "@/lib/types/menu";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  insertMenuTaxonomyRow,
  loadMenuTaxonomyRelational,
  menuRelationalPersistenceEnabled,
  reorderMenuTaxonomyRows,
  updateMenuTaxonomyRow,
} from "@/lib/supabase/menu-db";
import { migrateMenuTaxonomyFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";

const HEX = /^#[0-9A-Fa-f]{6}$/;

function taxonomyTable(
  storageKey: string,
): "menu_tags" | "menu_allergens" | null {
  if (storageKey === MENU_TAXONOMY_TAGS_KEY) return "menu_tags";
  if (storageKey === MENU_TAXONOMY_ALLERGENS_KEY) return "menu_allergens";
  return null;
}

function normalizeColor(hex: string | undefined): string {
  if (hex && HEX.test(hex)) return hex;
  return "#64748b";
}

function normalizeTaxonomy(c: MenuTaxonomyDefinition): MenuTaxonomyDefinition {
  return {
    ...c,
    active: c.active !== false,
    backgroundColor: normalizeColor(c.backgroundColor),
  };
}

function isValidLoose(x: unknown): x is MenuTaxonomyDefinition {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || !o.name.trim()) {
    return false;
  }
  if (o.active !== undefined && typeof o.active !== "boolean") return false;
  if (o.backgroundColor !== undefined && typeof o.backgroundColor !== "string") {
    return false;
  }
  return true;
}

export function useMenuTaxonomyStorage(
  storageKey: string,
  initialSeed: MenuTaxonomyDefinition[],
) {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const useDbMenu =
    menuRelationalPersistenceEnabled() && taxonomyTable(storageKey) != null;
  const table = taxonomyTable(storageKey);

  const [items, setItems] = useState<MenuTaxonomyDefinition[]>(() =>
    initialSeed.map(normalizeTaxonomy),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    if (useDbMenu && table) {
      void (async () => {
        const rid = await getWorkspaceRestaurantId();
        if (rid) {
          await migrateMenuTaxonomyFromLegacyAppStateIfEmpty(
            table,
            storageKey,
            rid,
            initialSeed.map(normalizeTaxonomy),
          );
        }
        const rows = await loadMenuTaxonomyRelational(table);
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setItems(rows.map(normalizeTaxonomy));
        } else {
          setItems(initialSeed.map(normalizeTaxonomy));
        }
        setIsHydrated(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    let parsed: MenuTaxonomyDefinition[] | null = null;
    const localRaw = loadWorkspaceJsonLocal(storageKey);
    if (Array.isArray(localRaw) && localRaw.every(isValidLoose)) {
      parsed = localRaw.map(normalizeTaxonomy);
    }
    if (supabaseOnly) {
      if (cancelled) return;
      setItems(parsed && parsed.length > 0 ? parsed : initialSeed.map(normalizeTaxonomy));
      setIsHydrated(true);
      return;
    }
    if (!parsed) {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (!cancelled) setIsHydrated(true);
      });
      return () => {
        cancelled = true;
      };
    }
    mirrorWorkspaceJsonLocal(storageKey, parsed);
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (cancelled) return;
      setItems(parsed!);
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey, supabaseOnly, useDbMenu, table, initialSeed]);

  const persist = useCallback(
    (next: MenuTaxonomyDefinition[], successMessage?: string) => {
      const cleaned = next.map(normalizeTaxonomy);
      setItems((prev) => {
        const ok = mirrorWorkspaceJsonLocal(storageKey, cleaned);
        if (!ok) {
          setItems(prev);
          failSave();
        } else if (successMessage) {
          toast.success(successMessage);
        }
        return cleaned;
      });
      return true;
    },
    [storageKey, failSave],
  );

  const persistDb = useCallback(
    async (
      next: MenuTaxonomyDefinition[],
      successMessage?: string,
    ): Promise<boolean> => {
      if (!table) return false;
      const rid = await getWorkspaceRestaurantId();
      if (!rid) {
        failSave();
        return false;
      }
      const ok = await reorderMenuTaxonomyRows(
        table,
        next.map((x) => x.id),
      );
      if (!ok) {
        failSave();
        return false;
      }
      setItems(next.map(normalizeTaxonomy));
      if (successMessage) toast.success(successMessage);
      return true;
    },
    [failSave, table],
  );

  const add = useCallback(
    async (
      name: string,
      active = true,
      backgroundColor = "#64748b",
    ): Promise<{ id: string; name: string } | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const color = normalizeColor(backgroundColor);
      if (useDbMenu && table) {
        const rid = await getWorkspaceRestaurantId();
        if (!rid) {
          failSave();
          return null;
        }
        const ins = await insertMenuTaxonomyRow(
          table,
          rid,
          trimmed,
          active,
          color,
        );
        if (!ins) {
          failSave();
          return null;
        }
        setItems((prev) => [
          ...prev,
          normalizeTaxonomy({
            id: ins.id,
            name: trimmed,
            active,
            backgroundColor: color,
          }),
        ]);
        toast.success("Eintrag angelegt");
        return { id: ins.id, name: trimmed };
      }
      const id = crypto.randomUUID();
      const ok = persist(
        [
          ...items,
          {
            id,
            name: trimmed,
            active,
            backgroundColor: color,
          },
        ],
        "Eintrag angelegt",
      );
      return ok ? { id, name: trimmed } : null;
    },
    [failSave, items, persist, table, useDbMenu],
  );

  const update = useCallback(
    (
      id: string,
      updates: {
        name?: string;
        active?: boolean;
        backgroundColor?: string;
      },
    ) => {
      if (useDbMenu && table) {
        void (async () => {
          const ok = await updateMenuTaxonomyRow(table, id, {
            name: updates.name,
            active: updates.active,
            backgroundColor: updates.backgroundColor,
          });
          if (!ok) {
            failSave();
            return;
          }
          setItems((prev) =>
            prev.map((c) => {
              if (c.id !== id) return c;
              return normalizeTaxonomy({
                ...c,
                ...updates,
                name:
                  updates.name !== undefined ? updates.name.trim() : c.name,
                backgroundColor:
                  updates.backgroundColor !== undefined
                    ? normalizeColor(updates.backgroundColor)
                    : c.backgroundColor,
              });
            }),
          );
          toast.success("Eintrag gespeichert");
        })();
        return;
      }
      persist(
        items.map((c) => {
          if (c.id !== id) return c;
          return normalizeTaxonomy({
            ...c,
            ...updates,
            name: updates.name !== undefined ? updates.name.trim() : c.name,
            backgroundColor:
              updates.backgroundColor !== undefined
                ? normalizeColor(updates.backgroundColor)
                : c.backgroundColor,
          });
        }),
        "Eintrag gespeichert",
      );
    },
    [failSave, items, persist, table, useDbMenu],
  );

  const reorder = useCallback(
    (next: MenuTaxonomyDefinition[]) => {
      const cleaned = next.map(normalizeTaxonomy);
      if (useDbMenu && table) {
        void persistDb(cleaned, "Reihenfolge aktualisiert");
        return;
      }
      persist(cleaned, "Reihenfolge aktualisiert");
    },
    [persist, persistDb, table, useDbMenu],
  );

  const getById = useCallback(
    (id: string) => items.find((c) => c.id === id),
    [items],
  );

  return {
    items,
    add,
    update,
    reorder,
    getById,
    isHydrated,
  };
}
