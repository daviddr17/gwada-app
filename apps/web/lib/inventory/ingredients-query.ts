"use client";

import { INGREDIENT_STORAGE_KEY } from "@/lib/constants/inventory-storage";
import { SEED_INGREDIENTS } from "@/lib/data/inventory-seeds";
import { migrateIngredientsFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import { loadIngredientsRelational } from "@/lib/supabase/inventory-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import type { Ingredient } from "@/lib/types/inventory";
import type { IngredientStockLogEntry } from "@/lib/types/ingredient-stock-log";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseStockLogEntry(raw: unknown): IngredientStockLogEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.at !== "string") return null;
  return raw as IngredientStockLogEntry;
}

function parseStockLogArray(raw: unknown): IngredientStockLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: IngredientStockLogEntry[] = [];
  for (const row of raw) {
    const e = parseStockLogEntry(row);
    if (e) out.push(e);
  }
  return out;
}

function normalizeIngredient(raw: Record<string, unknown>): Ingredient | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.unit !== "string" ||
    raw.unit.length === 0 ||
    typeof raw.currentStock !== "number" ||
    Number.isNaN(raw.currentStock) ||
    typeof raw.supplierId !== "string" ||
    typeof raw.categoryId !== "string" ||
    typeof raw.productionSiteId !== "string" ||
    typeof raw.brandId !== "string"
  ) {
    return null;
  }
  const lowStockThreshold =
    typeof raw.lowStockThreshold === "number" &&
    Number.isFinite(raw.lowStockThreshold)
      ? raw.lowStockThreshold
      : 0;

  return {
    id: raw.id,
    name: raw.name,
    unit: raw.unit,
    currentStock: raw.currentStock,
    lowStockThreshold,
    supplierId: raw.supplierId,
    categoryId: raw.categoryId,
    productionSiteId: raw.productionSiteId,
    brandId: raw.brandId,
    active: raw.active === false ? false : true,
    stockLog: parseStockLogArray(raw.stockLog),
  };
}

function parseIngredientsFromUnknown(parsed: unknown): Ingredient[] | null {
  if (!Array.isArray(parsed)) return null;
  const out: Ingredient[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const n = normalizeIngredient(row as Record<string, unknown>);
    if (n) out.push(n);
  }
  return out.length ? out : null;
}

export function peekIngredientsCache(): Ingredient[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(INGREDIENT_STORAGE_KEY);
    if (raw) return parseIngredientsFromUnknown(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return parseIngredientsFromUnknown(loadWorkspaceJsonLocal(INGREDIENT_STORAGE_KEY));
}

export async function fetchIngredientsForRestaurant(): Promise<Ingredient[]> {
  const rid = await getWorkspaceRestaurantId();
  const seed = [...SEED_INGREDIENTS];
  if (rid) {
    await migrateIngredientsFromLegacyAppStateIfEmpty(rid, seed);
  }
  const rows = await loadIngredientsRelational(rid);
  if (rows === null) {
    return seed;
  }
  mirrorWorkspaceJsonLocal(INGREDIENT_STORAGE_KEY, rows);
  return rows;
}
