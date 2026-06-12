"use client";

import {
  CATEGORY_STORAGE_KEY,
  DEFAULT_CATEGORIES,
} from "@/lib/constants/categories";
import { migrateMenuCategoriesFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import { loadMenuCategoriesRelational } from "@/lib/supabase/menu-db";
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

export function peekMenuCategoriesCache(): MenuCategoryDefinition[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (raw) return loadFromParsed(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return loadFromParsed(loadWorkspaceJsonLocal(CATEGORY_STORAGE_KEY));
}

export function defaultMenuCategories(): MenuCategoryDefinition[] {
  return DEFAULT_CATEGORIES.map(normalizeCategory);
}

export async function fetchMenuCategoriesForRestaurant(): Promise<
  MenuCategoryDefinition[]
> {
  const rid = await getWorkspaceRestaurantId();
  const seed = defaultMenuCategories();
  if (rid) {
    await migrateMenuCategoriesFromLegacyAppStateIfEmpty(rid, seed);
  }
  const rows = await loadMenuCategoriesRelational(rid);
  if (rows && rows.length > 0) {
    const next = rows.map(normalizeCategory);
    mirrorWorkspaceJsonLocal(CATEGORY_STORAGE_KEY, next);
    return next;
  }
  return seed;
}
