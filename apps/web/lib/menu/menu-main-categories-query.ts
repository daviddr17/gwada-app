"use client";

import {
  MAIN_CATEGORY_STORAGE_KEY,
  DEFAULT_MAIN_CATEGORIES,
} from "@/lib/constants/main-categories";
import { migrateMenuMainCategoriesIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import { loadMenuMainCategoriesRelational } from "@/lib/supabase/menu-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import type { MenuMainCategoryDefinition } from "@/lib/types/menu";

function normalizeMainCategory(
  c: MenuMainCategoryDefinition,
): MenuMainCategoryDefinition {
  return {
    ...c,
    active: c.active !== false,
  };
}

function isValidMainCategoryLoose(x: unknown): x is MenuMainCategoryDefinition {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || !o.name.trim()) {
    return false;
  }
  if (o.active !== undefined && typeof o.active !== "boolean") return false;
  return true;
}

function loadFromParsed(parsed: unknown): MenuMainCategoryDefinition[] | null {
  if (!Array.isArray(parsed) || !parsed.every(isValidMainCategoryLoose)) {
    return null;
  }
  return parsed.map(normalizeMainCategory);
}

export function peekMenuMainCategoriesCache(): MenuMainCategoryDefinition[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MAIN_CATEGORY_STORAGE_KEY);
    if (raw) return loadFromParsed(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return loadFromParsed(loadWorkspaceJsonLocal(MAIN_CATEGORY_STORAGE_KEY));
}

export function defaultMenuMainCategories(): MenuMainCategoryDefinition[] {
  return DEFAULT_MAIN_CATEGORIES.map(normalizeMainCategory);
}

export async function fetchMenuMainCategoriesForRestaurant(): Promise<
  MenuMainCategoryDefinition[]
> {
  const rid = await getWorkspaceRestaurantId();
  const seed = defaultMenuMainCategories();
  if (rid) {
    await migrateMenuMainCategoriesIfEmpty(rid, seed);
  }
  const rows = await loadMenuMainCategoriesRelational(rid);
  if (rows && rows.length > 0) {
    const next = rows.map(normalizeMainCategory);
    mirrorWorkspaceJsonLocal(MAIN_CATEGORY_STORAGE_KEY, next);
    return next;
  }
  return seed;
}
