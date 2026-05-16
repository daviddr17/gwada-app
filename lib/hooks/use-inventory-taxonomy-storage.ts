"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import { toastStorageError } from "@/lib/persist-notify";

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
  const [items, setItems] = useState<InventoryTaxonomyDefinition[]>(() =>
    initialSeed.map(normalizeTaxonomy),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let parsed: InventoryTaxonomyDefinition[] | null = null;
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
    const frame = requestAnimationFrame(() => {
      if (parsed && parsed.length > 0) setItems(parsed);
      setIsHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const persist = useCallback(
    (next: InventoryTaxonomyDefinition[], successMessage?: string) => {
      const cleaned = next.map(normalizeTaxonomy);
      try {
        localStorage.setItem(storageKey, JSON.stringify(cleaned));
        setItems(cleaned);
        if (successMessage) {
          toast.success(successMessage);
        }
        return true;
      } catch (e) {
        console.error(e);
        toastStorageError();
        return false;
      }
    },
    [storageKey],
  );

  const add = useCallback(
    (name: string, active = true) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const id = crypto.randomUUID();
      const ok = persist(
        [...items, { id, name: trimmed, active }],
        "Eintrag angelegt",
      );
      return ok ? { id, name: trimmed } : null;
    },
    [items, persist],
  );

  const update = useCallback(
    (id: string, updates: { name?: string; active?: boolean }) => {
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
    [items, persist],
  );

  const reorder = useCallback(
    (next: InventoryTaxonomyDefinition[]) => {
      persist(next.map(normalizeTaxonomy), "Reihenfolge aktualisiert");
    },
    [persist],
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
