import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getWorkspaceRestaurantId,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLogEntry,
} from "@/lib/types/purchase-order";
import type { Ingredient } from "@/lib/types/inventory";
import type { IngredientStockLogEntry } from "@/lib/types/ingredient-stock-log";

export function inventoryRelationalPersistenceEnabled(): boolean {
  return workspacePersistenceConfigured();
}

import type { InventoryTaxonomyDbTable } from "@/lib/constants/inventory-taxonomy-tables";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Parse stock log JSON (same rules as use-ingredients-storage). */
export function parseStockLogEntryFromJson(raw: unknown): IngredientStockLogEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.at !== "string") return null;
  const userFirstName = typeof raw.userFirstName === "string" ? raw.userFirstName : "";
  const userLastName = typeof raw.userLastName === "string" ? raw.userLastName : "";
  const userSource =
    raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;

  if (raw.kind === "manual_stock") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "manual_stock",
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    };
  }
  if (raw.kind === "stock_from_delivery") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    if (typeof raw.orderId !== "string" || typeof raw.supplierName !== "string") return null;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "stock_from_delivery",
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      orderId: raw.orderId,
      supplierName: raw.supplierName,
    };
  }
  if (raw.kind === "stock_delivery_reverted") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    if (typeof raw.orderId !== "string" || typeof raw.supplierName !== "string") return null;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "stock_delivery_reverted",
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      orderId: raw.orderId,
      supplierName: raw.supplierName,
    };
  }
  if (raw.kind === "stock_from_invoice") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;
    if (typeof raw.invoiceId !== "string" || typeof raw.articleName !== "string") return null;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "stock_from_invoice",
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      invoiceId: raw.invoiceId,
      voucherNumber:
        typeof raw.voucherNumber === "string" ? raw.voucherNumber : null,
      articleName: raw.articleName,
    };
  }
  return null;
}

function parseLogEntryFromJson(raw: unknown): PurchaseOrderLogEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.at !== "string") return null;
  if (typeof raw.ingredientId !== "string" || typeof raw.ingredientName !== "string")
    return null;
  if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;

  let userFirstName = typeof raw.userFirstName === "string" ? raw.userFirstName : "";
  let userLastName = typeof raw.userLastName === "string" ? raw.userLastName : "";
  if (userFirstName === "" && userLastName === "" && typeof raw.userName === "string") {
    userLastName = raw.userName;
  }

  if (raw.kind === "add_to_order") {
    if (typeof raw.quantity !== "number" || Number.isNaN(raw.quantity) || raw.quantity <= 0)
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "add_to_order",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      quantity: raw.quantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    };
  }
  if (raw.kind === "quantity_change") {
    if (
      typeof raw.fromQuantity !== "number" ||
      typeof raw.toQuantity !== "number" ||
      Number.isNaN(raw.fromQuantity) ||
      Number.isNaN(raw.toQuantity)
    )
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "quantity_change",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    };
  }
  if (raw.kind === "marked_delivered") {
    if (typeof raw.lineId !== "string") return null;
    if (typeof raw.quantity !== "number" || Number.isNaN(raw.quantity) || raw.quantity <= 0)
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "marked_delivered",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      quantity: raw.quantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      lineId: raw.lineId,
    };
  }
  if (raw.kind === "delivery_reverted") {
    if (typeof raw.lineId !== "string") return null;
    if (typeof raw.quantity !== "number" || Number.isNaN(raw.quantity) || raw.quantity <= 0)
      return null;
    const userSource =
      raw.userSource === "local_profile" ? ("local_profile" as const) : undefined;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      ...(userSource ? { userSource } : {}),
      kind: "delivery_reverted",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      quantity: raw.quantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
      lineId: raw.lineId,
    };
  }
  if (typeof raw.quantityDelta === "number" && !Number.isNaN(raw.quantityDelta)) {
    if (typeof raw.userName !== "string") return null;
    return {
      id: raw.id,
      at: raw.at,
      userName: raw.userName,
      kind: "legacy_adjustment",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      quantityDelta: raw.quantityDelta,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    };
  }
  return null;
}

function parseLineFromRow(r: Record<string, unknown>): PurchaseOrderLine | null {
  if (typeof r.id !== "string" || typeof r.ingredient_id !== "string") return null;
  if (typeof r.ingredient_name !== "string") return null;
  if (typeof r.quantity !== "number" && typeof r.quantity !== "string") return null;
  const qty = Number(r.quantity);
  if (Number.isNaN(qty)) return null;
  if (typeof r.unit_id !== "string" || typeof r.unit_label !== "string") return null;
  const brandLabel =
    typeof r.brand_label === "string" && r.brand_label.trim() !== ""
      ? r.brand_label
      : undefined;
  let deliveredAt: string | undefined;
  if (typeof r.delivered_at === "string" && r.delivered_at.length > 0) {
    deliveredAt = r.delivered_at;
  }
  return {
    id: r.id,
    ingredientId: r.ingredient_id as string,
    ingredientName: r.ingredient_name as string,
    ...(brandLabel !== undefined ? { brandLabel } : {}),
    quantity: qty,
    unitId: r.unit_id as string,
    unitLabel: r.unit_label as string,
    ...(deliveredAt !== undefined ? { deliveredAt } : {}),
  };
}

export async function loadInventoryTaxonomyRelational(
  table: InventoryTaxonomyDbTable,
  restaurantId?: string | null,
): Promise<InventoryTaxonomyDefinition[] | null> {
  const rid = restaurantId ?? (await getWorkspaceRestaurantId());
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(table)
    .select("id,name,is_active,sort_order")
    .eq("restaurant_id", rid)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn(`[gwada] ${table}`, error.message);
    return null;
  }
  if (!data?.length) return [];
  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    active: (r.is_active as boolean) !== false,
  }));
}

export async function insertInventoryTaxonomyRow(
  table: InventoryTaxonomyDbTable,
  restaurantId: string,
  id: string,
  name: string,
  active: boolean,
): Promise<boolean> {
  return upsertInventoryTaxonomyRow(table, restaurantId, id, name, active);
}

/** Legt Stammdaten-Zeile an oder aktualisiert Name/Aktiv (z. B. vor Bestell-RPC). */
export async function upsertInventoryTaxonomyRow(
  table: InventoryTaxonomyDbTable,
  restaurantId: string,
  id: string,
  name: string,
  active: boolean,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase.from(table).upsert(
    {
      restaurant_id: restaurantId,
      id,
      name,
      is_active: active,
      sort_order: sortOrder,
    },
    { onConflict: "restaurant_id,id" },
  );
  if (error) {
    console.warn(`[gwada] upsert ${table}`, error.message);
    return false;
  }
  return true;
}

/** Lieferanten aus offenen/abgeschlossenen Bestellungen in inventory_suppliers spiegeln. */
export async function ensurePurchaseOrderSuppliers(
  restaurantId: string,
  orders: PurchaseOrder[],
): Promise<boolean> {
  const byId = new Map<string, string>();
  for (const o of orders) {
    const sid = o.supplierId?.trim();
    if (!sid) continue;
    byId.set(sid, o.supplierName?.trim() || sid);
  }
  for (const [id, name] of byId) {
    const ok = await upsertInventoryTaxonomyRow(
      "inventory_suppliers",
      restaurantId,
      id,
      name,
      true,
    );
    if (!ok) return false;
  }
  return true;
}

export async function updateInventoryTaxonomyRow(
  table: InventoryTaxonomyDbTable,
  restaurantId: string,
  id: string,
  updates: { name?: string; active?: boolean },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.active !== undefined) patch.is_active = updates.active;
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase
    .from(table)
    .update(patch)
    .eq("restaurant_id", restaurantId)
    .eq("id", id);
  if (error) {
    console.warn(`[gwada] update ${table}`, error.message);
    return false;
  }
  return true;
}

export async function deleteInventoryTaxonomyRow(
  table: InventoryTaxonomyDbTable,
  restaurantId: string,
  id: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", id);
  if (error) {
    console.warn(`[gwada] delete ${table}`, error.message);
    return false;
  }
  return true;
}

export async function reorderInventoryTaxonomyRows(
  table: InventoryTaxonomyDbTable,
  restaurantId: string,
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from(table)
      .update({ sort_order: i })
      .eq("restaurant_id", restaurantId)
      .eq("id", orderedIds[i]);
    if (error) {
      console.warn(`[gwada] reorder ${table}`, error.message);
      return false;
    }
  }
  return true;
}

export async function loadIngredientsRelational(
  restaurantId?: string | null,
): Promise<Ingredient[] | null> {
  const rid = restaurantId ?? (await getWorkspaceRestaurantId());
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data: ings, error: e1 } = await supabase
    .from("inventory_ingredients")
    .select(
      "id,name,unit,current_stock,supplier_id,category_id,production_site_id,brand_id,is_active",
    )
    .eq("restaurant_id", rid)
    .order("name", { ascending: true });
  if (e1) {
    console.warn("[gwada] inventory_ingredients", e1.message);
    return null;
  }
  const { data: logs, error: e2 } = await supabase
    .from("inventory_stock_log_entries")
    .select("ingredient_id,seq,entry")
    .eq("restaurant_id", rid)
    .order("ingredient_id", { ascending: true })
    .order("seq", { ascending: true });
  if (e2) {
    console.warn("[gwada] inventory_stock_log_entries", e2.message);
    return null;
  }
  const byIng = new Map<string, IngredientStockLogEntry[]>();
  for (const row of logs ?? []) {
    const ingId = row.ingredient_id as string;
    const ent = parseStockLogEntryFromJson(row.entry);
    if (!ent) continue;
    const arr = byIng.get(ingId) ?? [];
    arr.push(ent);
    byIng.set(ingId, arr);
  }
  const out: Ingredient[] = [];
  for (const r of ings ?? []) {
    const o = r as Record<string, unknown>;
    out.push({
      id: o.id as string,
      name: o.name as string,
      unit: o.unit as string,
      currentStock: Number(o.current_stock),
      supplierId: o.supplier_id as string,
      categoryId: o.category_id as string,
      productionSiteId: o.production_site_id as string,
      brandId: o.brand_id as string,
      active: (o.is_active as boolean) !== false,
      stockLog: byIng.get(o.id as string) ?? [],
    });
  }
  return out;
}

export async function saveIngredientsRelational(
  restaurantId: string,
  ingredients: Ingredient[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("inventory_replace_ingredients", {
    p_restaurant_id: restaurantId,
    p_ingredients: ingredients,
  });
  if (error) {
    console.warn("[gwada] inventory_replace_ingredients", error.message);
    return false;
  }
  return true;
}

export async function loadPurchaseOrdersRelational(
  restaurantId?: string | null,
): Promise<PurchaseOrder[] | null> {
  const rid = restaurantId ?? (await getWorkspaceRestaurantId());
  if (!rid) return null;
  const supabase = createSupabaseBrowserClient();
  const { data: orders, error: e1 } = await supabase
    .from("inventory_purchase_orders")
    .select(
      "id,supplier_id,supplier_name,status,created_at,created_by,created_by_user_source,delivery_date",
    )
    .eq("restaurant_id", rid)
    .order("created_at", { ascending: false });
  if (e1) {
    console.warn("[gwada] inventory_purchase_orders", e1.message);
    return null;
  }
  const { data: lines, error: e2 } = await supabase
    .from("inventory_purchase_order_lines")
    .select(
      "order_id,id,ingredient_id,ingredient_name,brand_label,quantity,unit_id,unit_label,delivered_at",
    )
    .eq("restaurant_id", rid);
  if (e2) {
    console.warn("[gwada] inventory_purchase_order_lines", e2.message);
    return null;
  }
  const { data: logRows, error: e3 } = await supabase
    .from("inventory_purchase_order_log_entries")
    .select("order_id,sort_order,entry")
    .eq("restaurant_id", rid)
    .order("order_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (e3) {
    console.warn("[gwada] inventory_purchase_order_log_entries", e3.message);
    return null;
  }

  const linesByOrder = new Map<string, PurchaseOrderLine[]>();
  for (const row of lines ?? []) {
    const lr = row as Record<string, unknown>;
    const oid = lr.order_id as string;
    const pl = parseLineFromRow(lr);
    if (!pl) continue;
    const arr = linesByOrder.get(oid) ?? [];
    arr.push(pl);
    linesByOrder.set(oid, arr);
  }

  const logByOrder = new Map<string, PurchaseOrderLogEntry[]>();
  for (const row of logRows ?? []) {
    const lr = row as Record<string, unknown>;
    const oid = lr.order_id as string;
    const ent = parseLogEntryFromJson(lr.entry);
    if (!ent) continue;
    const arr = logByOrder.get(oid) ?? [];
    arr.push(ent);
    logByOrder.set(oid, arr);
  }

  const out: PurchaseOrder[] = [];
  for (const row of orders ?? []) {
    const o = row as Record<string, unknown>;
    const id = o.id as string;
    const createdByUserSource =
      o.created_by_user_source === "local_profile"
        ? ("local_profile" as const)
        : undefined;
    let deliveryDate: string | null = null;
    if (typeof o.delivery_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.delivery_date)) {
      deliveryDate = o.delivery_date;
    }
    out.push({
      id,
      supplierId: o.supplier_id as string,
      supplierName: o.supplier_name as string,
      status: o.status as PurchaseOrder["status"],
      createdAt: o.created_at as string,
      createdBy: (o.created_by as string) ?? "",
      ...(createdByUserSource ? { createdByUserSource } : {}),
      deliveryDate,
      lines: linesByOrder.get(id) ?? [],
      log: logByOrder.get(id) ?? [],
    });
  }
  return out;
}

export type InventorySaveResult = { ok: true } | { ok: false; message: string };

export async function savePurchaseOrdersRelational(
  restaurantId: string,
  orders: PurchaseOrder[],
): Promise<InventorySaveResult> {
  await ensurePurchaseOrderSuppliers(restaurantId, orders);
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("inventory_replace_purchase_orders", {
    p_restaurant_id: restaurantId,
    p_orders: orders,
  });
  if (error) {
    console.warn("[gwada] inventory_replace_purchase_orders", error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
