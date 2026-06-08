import type { DashboardWidgetPrefs } from "@/lib/constants/dashboard-widgets";
import { CATEGORY_STORAGE_KEY } from "@/lib/constants/categories";
import {
  INGREDIENT_STORAGE_KEY,
  PURCHASE_ORDERS_STORAGE_KEY,
} from "@/lib/constants/inventory-storage";
import {
  MENU_TAXONOMY_ALLERGENS_KEY,
  MENU_TAXONOMY_TAGS_KEY,
} from "@/lib/constants/menu-taxonomy-storage";
import { defaultDashboardShortcutPrefs } from "@/lib/constants/dashboard-shortcuts";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  DEFAULT_DASHBOARD_WIDGET_VISIBILITY,
} from "@/lib/constants/dashboard-widgets";
import {
  insertMenuCategory,
  insertMenuItemRelational,
  insertMenuTaxonomyRow,
  loadMenuCategoriesRelational,
  loadMenuItemsRelational,
  loadMenuTaxonomyRelational,
} from "@/lib/supabase/menu-db";
import {
  loadIngredientsRelational,
  loadPurchaseOrdersRelational,
  saveIngredientsRelational,
  savePurchaseOrdersRelational,
} from "@/lib/supabase/inventory-db";
import { upsertUserRestaurantDashboardWidgets } from "@/lib/supabase/user-restaurant-dashboard-widgets";
import { readLegacyRestaurantAppStatePayload } from "@/lib/supabase/legacy-restaurant-app-state";
import type { MenuCategoryDefinition, MenuItem, MenuTaxonomyDefinition } from "@/lib/types/menu";
import type { Ingredient } from "@/lib/types/inventory";
import type { PurchaseOrder, PurchaseOrdersPersistenceV1 } from "@/lib/types/purchase-order";

const MENU_STORAGE_KEY = "gwada-menu-v1";

/** Einmalige Übernahme aus `restaurant_app_state`, wenn relationale Tabellen leer sind. */
export async function migrateMenuItemsFromLegacyAppStateIfEmpty(
  restaurantId: string,
): Promise<void> {
  const existing = await loadMenuItemsRelational();
  if (existing && existing.length > 0) return;

  const legacyRaw = await readLegacyRestaurantAppStatePayload(MENU_STORAGE_KEY);
  if (!Array.isArray(legacyRaw) || legacyRaw.length === 0) return;

  for (const row of legacyRaw) {
    if (!row || typeof row !== "object") continue;
    const item = row as MenuItem;
    if (typeof item.id !== "string" || typeof item.name !== "string") continue;
    await insertMenuItemRelational({
      ...item,
      active: item.active !== false,
    });
  }
}

export async function migrateMenuCategoriesFromLegacyAppStateIfEmpty(
  restaurantId: string,
  fallback: MenuCategoryDefinition[],
): Promise<void> {
  const existing = await loadMenuCategoriesRelational();
  if (existing && existing.length > 0) return;

  const legacyRaw = await readLegacyRestaurantAppStatePayload(CATEGORY_STORAGE_KEY);
  const legacy =
    Array.isArray(legacyRaw) && legacyRaw.length > 0
      ? (legacyRaw as MenuCategoryDefinition[])
      : fallback;

  for (const cat of legacy) {
    if (typeof cat.id !== "string" || typeof cat.name !== "string") continue;
    await insertMenuCategory(restaurantId, cat.name, cat.active !== false);
  }
}

export async function migrateMenuTaxonomyFromLegacyAppStateIfEmpty(
  table: "menu_tags" | "menu_allergens",
  storageKey: string,
  restaurantId: string,
  fallback: MenuTaxonomyDefinition[],
): Promise<void> {
  const existing = await loadMenuTaxonomyRelational(table);
  if (existing && existing.length > 0) return;

  const legacyRaw = await readLegacyRestaurantAppStatePayload(storageKey);
  const legacy =
    Array.isArray(legacyRaw) && legacyRaw.length > 0
      ? (legacyRaw as MenuTaxonomyDefinition[])
      : fallback;

  for (const row of legacy) {
    if (typeof row.id !== "string" || typeof row.name !== "string") continue;
    await insertMenuTaxonomyRow(
      table,
      restaurantId,
      row.name,
      row.active !== false,
      row.backgroundColor ?? "#64748b",
    );
  }
}

export async function migrateIngredientsFromLegacyAppStateIfEmpty(
  restaurantId: string,
  ingredients: Ingredient[],
): Promise<void> {
  const existing = await loadIngredientsRelational();
  if (existing && existing.length > 0) return;

  const legacyRaw = await readLegacyRestaurantAppStatePayload(INGREDIENT_STORAGE_KEY);
  if (!Array.isArray(legacyRaw) || legacyRaw.length === 0) {
    if (ingredients.length > 0) {
      await saveIngredientsRelational(restaurantId, ingredients);
    }
    return;
  }

  const parsed = legacyRaw as Ingredient[];
  if (parsed.length > 0) {
    await saveIngredientsRelational(restaurantId, parsed);
  }
}

export async function migratePurchaseOrdersFromLegacyAppStateIfEmpty(
  restaurantId: string,
): Promise<void> {
  const existing = await loadPurchaseOrdersRelational();
  if (existing && existing.length > 0) return;

  const legacyRaw = await readLegacyRestaurantAppStatePayload(PURCHASE_ORDERS_STORAGE_KEY);
  if (!legacyRaw || typeof legacyRaw !== "object" || Array.isArray(legacyRaw)) {
    return;
  }
  const orders = (legacyRaw as PurchaseOrdersPersistenceV1).orders;
  if (!Array.isArray(orders) || orders.length === 0) return;
  await savePurchaseOrdersRelational(restaurantId, orders as PurchaseOrder[]);
}

export async function migrateDashboardWidgetsFromLegacyAppStateIfEmpty(
  profileId: string,
  restaurantId: string,
): Promise<void> {
  const legacyRaw = await readLegacyRestaurantAppStatePayload(DASHBOARD_WIDGET_STORAGE_KEY);
  if (!legacyRaw || typeof legacyRaw !== "object" || Array.isArray(legacyRaw)) {
    return;
  }
  const o = legacyRaw as Record<string, unknown>;
  const visibility =
    o.visibility && typeof o.visibility === "object" && !Array.isArray(o.visibility)
      ? (o.visibility as DashboardWidgetPrefs["visibility"])
      : DEFAULT_DASHBOARD_WIDGET_VISIBILITY;
  const order = Array.isArray(o.order)
    ? (o.order as DashboardWidgetPrefs["order"])
    : DEFAULT_DASHBOARD_WIDGET_ORDER;
  await upsertUserRestaurantDashboardWidgets(profileId, restaurantId, {
    visibility,
    order,
    shortcuts: defaultDashboardShortcutPrefs(),
  });
}

export const MENU_TAXONOMY_MIGRATION_KEYS = {
  tags: MENU_TAXONOMY_TAGS_KEY,
  allergens: MENU_TAXONOMY_ALLERGENS_KEY,
} as const;
