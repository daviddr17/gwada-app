"use client";

import { mockMenu } from "@/lib/data/mock-menu";
import { normalizeMenuItem } from "@/lib/menu/item-utils";
import { migrateMenuItemsFromLegacyAppStateIfEmpty } from "@/lib/supabase/app-state-relational-migration";
import { loadMenuItemsRelational } from "@/lib/supabase/menu-db";
import {
  getWorkspaceRestaurantId,
  loadWorkspaceJsonLocal,
  mirrorWorkspaceJsonLocal,
} from "@/lib/supabase/workspace-persistence";
import type { MenuItem } from "@/lib/types/menu";

export const MENU_ITEMS_STORAGE_KEY = "gwada-menu-v1";

function parseMenuItemsFromRemote(remote: unknown): MenuItem[] | null {
  if (!Array.isArray(remote)) return null;
  const out: MenuItem[] = [];
  for (const row of remote) {
    if (!row || typeof row !== "object") continue;
    const n = normalizeMenuItem(row as Record<string, unknown>);
    if (n) out.push(n);
  }
  return out.length ? out : null;
}

export function peekMenuItemsCache(): MenuItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MENU_ITEMS_STORAGE_KEY);
    if (raw) {
      const parsed = parseMenuItemsFromRemote(JSON.parse(raw));
      if (parsed?.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return parseMenuItemsFromRemote(loadWorkspaceJsonLocal(MENU_ITEMS_STORAGE_KEY));
}

export async function fetchMenuItemsForRestaurant(): Promise<MenuItem[]> {
  const rid = await getWorkspaceRestaurantId();
  if (rid) {
    await migrateMenuItemsFromLegacyAppStateIfEmpty(rid);
  }
  const rows = await loadMenuItemsRelational(rid);
  if (rows && rows.length > 0) {
    mirrorWorkspaceJsonLocal(MENU_ITEMS_STORAGE_KEY, rows);
    return rows;
  }
  return [];
}

export function normalizeSeedItems(seed: MenuItem[]): MenuItem[] {
  return seed.map((row) => {
    const n = normalizeMenuItem({ ...row } as unknown as Record<string, unknown>);
    return n ?? row;
  });
}

export function defaultMenuSeedItems(): MenuItem[] {
  return normalizeSeedItems(mockMenu);
}
