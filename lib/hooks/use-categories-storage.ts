"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CATEGORY_STORAGE_KEY,
  DEFAULT_CATEGORIES,
} from "@/lib/constants/categories";
import { toastStorageError } from "@/lib/persist-notify";
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

function loadFromStorage(): MenuCategoryDefinition[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isValidCategoryLoose)) return null;
    return parsed.map(normalizeCategory);
  } catch {
    return null;
  }
}

export function useCategoriesStorage() {
  const [categories, setCategories] = useState<MenuCategoryDefinition[]>(() =>
    DEFAULT_CATEGORIES.map(normalizeCategory),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = loadFromStorage();
    const frame = requestAnimationFrame(() => {
      if (stored && stored.length > 0) setCategories(stored.map(normalizeCategory));
      setIsHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const addCategory = useCallback(
    (name: string, active = true) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const id = crypto.randomUUID();
      const next = [...categories, { id, name: trimmed, active }];
      try {
        const cleaned = next.map(normalizeCategory);
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cleaned));
        setCategories(cleaned);
        toast.success("Kategorie angelegt");
        return { id, name: trimmed };
      } catch (e) {
        console.error(e);
        toastStorageError();
        return null;
      }
    },
    [categories],
  );

  const updateCategory = useCallback(
    (id: string, updates: { name?: string; active?: boolean }) => {
      const next = categories.map((c) => {
        if (c.id !== id) return c;
        return normalizeCategory({
          ...c,
          ...updates,
          name: updates.name !== undefined ? updates.name.trim() : c.name,
        });
      });
      try {
        const cleaned = next.map(normalizeCategory);
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cleaned));
        setCategories(cleaned);
        toast.success("Kategorie gespeichert");
      } catch (e) {
        console.error(e);
        toastStorageError();
      }
    },
    [categories],
  );

  const reorderCategories = useCallback(
    (next: MenuCategoryDefinition[]) => {
      const cleaned = next.map(normalizeCategory);
      try {
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cleaned));
        setCategories(cleaned);
        toast.success("Kategorien sortiert");
      } catch (e) {
        console.error(e);
        toastStorageError();
      }
    },
    [],
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
