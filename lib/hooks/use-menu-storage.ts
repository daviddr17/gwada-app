"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { mockMenu } from "@/lib/data/mock-menu";
import { normalizeMenuItem } from "@/lib/menu/item-utils";
import { toastStorageError } from "@/lib/persist-notify";
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

export function useMenuStorage() {
  const [items, setItems] = useState<MenuItem[]>(() => normalizeSeedItems(mockMenu));
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = loadFromStorage();
    const frame = requestAnimationFrame(() => {
      if (stored) setItems(stored);
      else setItems((prev) => normalizeSeedItems(prev));
      setIsHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const addItem = useCallback((item: NewMenuItem): MenuItem | null => {
    const newItem: MenuItem = {
      ...item,
      id: crypto.randomUUID(),
      active: item.active !== false,
      listNumber:
        item.listNumber != null && !Number.isNaN(item.listNumber)
          ? item.listNumber
          : null,
    };
    let ok = false;
    setItems((prev) => {
      const next = [newItem, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        ok = true;
        return next;
      } catch (e) {
        console.error(e);
        return prev;
      }
    });
    if (ok) {
      toast.success("Gericht hinzugefügt");
      return newItem;
    }
    toastStorageError();
    return null;
  }, []);

  const updateItem = useCallback((id: string, item: NewMenuItem): boolean => {
    let ok = false;
    setItems((prev) => {
      const next = prev.map((existing) =>
        existing.id === id
          ? {
              ...item,
              id,
              active: item.active !== false,
              listNumber:
                item.listNumber != null && !Number.isNaN(item.listNumber)
                  ? item.listNumber
                  : null,
            }
          : existing,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        ok = true;
        return next;
      } catch (e) {
        console.error(e);
        return prev;
      }
    });
    if (ok) {
      toast.success("Gericht gespeichert");
    } else {
      toastStorageError();
    }
    return ok;
  }, []);

  const getItemById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items],
  );

  const reorderItemsInCategory = useCallback(
    (categoryId: string, orderedIds: string[]) => {
      let ok = false;
      setItems((prev) => {
        const next = prev.map((item) => {
          if (item.category !== categoryId) return item;
          const pos = orderedIds.indexOf(item.id);
          if (pos === -1) return item;
          return { ...item, listNumber: pos + 1 };
        });
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          ok = true;
          return next;
        } catch (e) {
          console.error(e);
          return prev;
        }
      });
      if (ok) {
        toast.success("Reihenfolge der Gerichte aktualisiert");
      } else {
        toastStorageError();
      }
    },
    [],
  );

  return {
    items,
    addItem,
    updateItem,
    getItemById,
    reorderItemsInCategory,
    isHydrated,
  };
}
