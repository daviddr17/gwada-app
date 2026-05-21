"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { inventoryTaxonomyTableForStorageKey } from "@/lib/constants/inventory-taxonomy-tables";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  inventoryRelationalPersistenceEnabled,
  loadInventoryTaxonomyRelational,
  reorderInventoryTaxonomyRows,
  updateInventoryTaxonomyRow,
  upsertInventoryTaxonomyRow,
} from "@/lib/supabase/inventory-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJson,
  persistWorkspaceState,
} from "@/lib/supabase/workspace-persistence";

function normalizeTaxonomy(
  c: InventoryTaxonomyDefinition,
): InventoryTaxonomyDefinition {
  return {
    ...c,
    active: c.active !== false,
  };
}

function isValidLoose(x: unknown): x is InventoryTaxonomyDefinition {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || !o.name.trim()) {
    return false;
  }
  if (o.active !== undefined && typeof o.active !== "boolean") return false;
  return true;
}

export function useInventoryTaxonomyStorage(
  storageKey: string,
  initialSeed: InventoryTaxonomyDefinition[],
) {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;
  const table = inventoryTaxonomyTableForStorageKey(storageKey);
  const useDbInventory =
    inventoryRelationalPersistenceEnabled() && table != null;

  const [items, setItems] = useState<InventoryTaxonomyDefinition[]>(() =>
    initialSeed.map(normalizeTaxonomy),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    if (useDbInventory && table) {
      void (async () => {
        const rows = await loadInventoryTaxonomyRelational(table);
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setItems(rows.map(normalizeTaxonomy));
        } else {
          const seeded = initialSeed.map(normalizeTaxonomy);
          setItems(seeded);
          const rid = await getWorkspaceRestaurantId();
          if (rid && seeded.length > 0) {
            for (const item of seeded) {
              await upsertInventoryTaxonomyRow(
                table,
                rid,
                item.id,
                item.name,
                item.active !== false,
              );
            }
          }
        }
        setIsHydrated(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const remote = await loadWorkspaceJson(storageKey);
      let parsed: InventoryTaxonomyDefinition[] | null = null;
      if (Array.isArray(remote) && remote.every(isValidLoose)) {
        parsed = remote.map(normalizeTaxonomy);
      }
      if (supabaseOnly) {
        if (cancelled) return;
        setItems(parsed && parsed.length > 0 ? parsed : initialSeed.map(normalizeTaxonomy));
        setIsHydrated(true);
        return;
      }
      if (!parsed) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const data: unknown = JSON.parse(raw);
            if (Array.isArray(data) && data.every(isValidLoose)) {
              parsed = data.map(normalizeTaxonomy);
            }
          }
        } catch {
          parsed = null;
        }
      } else {
        try {
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        if (parsed && parsed.length > 0) setItems(parsed);
        setIsHydrated(true);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, supabaseOnly, useDbInventory, table, initialSeed]);

  const persist = useCallback(
    (next: InventoryTaxonomyDefinition[], successMessage?: string) => {
      const cleaned = next.map(normalizeTaxonomy);
      setItems((prev) => {
        void persistWorkspaceState(storageKey, cleaned).then((ok) => {
          if (!ok) {
            setItems(prev);
            failSave();
          } else if (successMessage) {
            toast.success(successMessage);
          }
        });
        return cleaned;
      });
      return true;
    },
    [storageKey, failSave],
  );

  const persistDbReorder = useCallback(
    async (
      next: InventoryTaxonomyDefinition[],
      successMessage?: string,
    ): Promise<boolean> => {
      if (!table) return false;
      const rid = await getWorkspaceRestaurantId();
      if (!rid) {
        failSave();
        return false;
      }
      const ok = await reorderInventoryTaxonomyRows(
        table,
        rid,
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
    ): Promise<{ id: string; name: string } | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      if (useDbInventory && table) {
        const rid = await getWorkspaceRestaurantId();
        if (!rid) {
          failSave();
          return null;
        }
        const id = crypto.randomUUID();
        const ok = await upsertInventoryTaxonomyRow(
          table,
          rid,
          id,
          trimmed,
          active,
        );
        if (!ok) {
          failSave();
          return null;
        }
        setItems((prev) => [
          ...prev,
          normalizeTaxonomy({ id, name: trimmed, active }),
        ]);
        toast.success("Eintrag angelegt");
        return { id, name: trimmed };
      }
      const id = crypto.randomUUID();
      const ok = persist(
        [...items, { id, name: trimmed, active }],
        "Eintrag angelegt",
      );
      return ok ? { id, name: trimmed } : null;
    },
    [failSave, items, persist, table, useDbInventory],
  );

  const update = useCallback(
    (
      id: string,
      updates: { name?: string; active?: boolean },
    ) => {
      if (useDbInventory && table) {
        void (async () => {
          const rid = await getWorkspaceRestaurantId();
          if (!rid) {
            failSave();
            return;
          }
          const ok = await updateInventoryTaxonomyRow(table, rid, id, updates);
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
          });
        }),
        "Eintrag gespeichert",
      );
    },
    [failSave, items, persist, table, useDbInventory],
  );

  const reorder = useCallback(
    (next: InventoryTaxonomyDefinition[]) => {
      const cleaned = next.map(normalizeTaxonomy);
      if (useDbInventory && table) {
        void persistDbReorder(cleaned, "Reihenfolge aktualisiert");
        return;
      }
      persist(cleaned, "Reihenfolge aktualisiert");
    },
    [persist, persistDbReorder, table, useDbInventory],
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
