import "server-only";

import { createId } from "@/lib/create-id";
import { parseStockLogEntryFromJson } from "@/lib/supabase/inventory-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Ingredient } from "@/lib/types/inventory";
import type { IngredientStockLogEntry } from "@/lib/types/ingredient-stock-log";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLogAdd,
  PurchaseOrderLogEntry,
  PurchaseOrderLogQuantityChange,
} from "@/lib/types/purchase-order";

export type DisplayInventoryFilterOption = { id: string; name: string };

export type DisplayInventoryIngredientRow = {
  id: string;
  name: string;
  unitId: string;
  unitLabel: string;
  currentStock: number;
  supplierId: string;
  supplierName: string;
  categoryId: string;
  categoryName: string;
  productionSiteId: string;
  productionSiteName: string;
  brandId: string;
  brandLabel: string;
  canOrder: boolean;
  orderId: string | null;
  orderLineId: string | null;
  orderQuantity: number;
};

export type DisplayInventoryPayload = {
  ingredients: DisplayInventoryIngredientRow[];
  suppliers: DisplayInventoryFilterOption[];
  categories: DisplayInventoryFilterOption[];
  productionSites: DisplayInventoryFilterOption[];
};

type StaffActor = { firstName: string; lastName: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseLogEntryFromJson(raw: unknown): PurchaseOrderLogEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.at !== "string") return null;
  if (typeof raw.ingredientId !== "string" || typeof raw.ingredientName !== "string")
    return null;
  if (typeof raw.unitId !== "string" || typeof raw.unitLabel !== "string") return null;

  const userFirstName = typeof raw.userFirstName === "string" ? raw.userFirstName : "";
  const userLastName = typeof raw.userLastName === "string" ? raw.userLastName : "";

  if (raw.kind === "add_to_order") {
    if (typeof raw.quantity !== "number" || Number.isNaN(raw.quantity) || raw.quantity <= 0)
      return null;
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
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
    return {
      id: raw.id,
      at: raw.at,
      userFirstName,
      userLastName,
      kind: "quantity_change",
      ingredientId: raw.ingredientId,
      ingredientName: raw.ingredientName,
      fromQuantity: raw.fromQuantity,
      toQuantity: raw.toQuantity,
      unitId: raw.unitId,
      unitLabel: raw.unitLabel,
    };
  }
  return null;
}

function parseLineFromRow(r: Record<string, unknown>): PurchaseOrderLine | null {
  if (typeof r.id !== "string" || typeof r.ingredient_id !== "string") return null;
  if (typeof r.ingredient_name !== "string") return null;
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

async function loadIngredientsAdmin(
  restaurantId: string,
): Promise<Ingredient[] | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: ings, error: e1 } = await admin
    .from("inventory_ingredients")
    .select(
      "id,name,unit,current_stock,supplier_id,category_id,production_site_id,brand_id,is_active",
    )
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });
  if (e1) return null;

  const { data: logs, error: e2 } = await admin
    .from("inventory_stock_log_entries")
    .select("ingredient_id,seq,entry")
    .eq("restaurant_id", restaurantId)
    .order("ingredient_id", { ascending: true })
    .order("seq", { ascending: true });
  if (e2) return null;

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

async function saveIngredientsAdmin(
  restaurantId: string,
  ingredients: Ingredient[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };
  const { error } = await admin.rpc("inventory_replace_ingredients", {
    p_restaurant_id: restaurantId,
    p_ingredients: ingredients,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function loadPurchaseOrdersAdmin(
  restaurantId: string,
): Promise<PurchaseOrder[] | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: orders, error: e1 } = await admin
    .from("inventory_purchase_orders")
    .select(
      "id,supplier_id,supplier_name,status,created_at,created_by,created_by_user_source,delivery_date",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (e1) return null;

  const { data: lines, error: e2 } = await admin
    .from("inventory_purchase_order_lines")
    .select(
      "order_id,id,ingredient_id,ingredient_name,brand_label,quantity,unit_id,unit_label,delivered_at",
    )
    .eq("restaurant_id", restaurantId);
  if (e2) return null;

  const { data: logRows, error: e3 } = await admin
    .from("inventory_purchase_order_log_entries")
    .select("order_id,sort_order,entry")
    .eq("restaurant_id", restaurantId)
    .order("order_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (e3) return null;

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

async function savePurchaseOrdersAdmin(
  restaurantId: string,
  orders: PurchaseOrder[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };
  const { error } = await admin.rpc("inventory_replace_purchase_orders", {
    p_restaurant_id: restaurantId,
    p_orders: orders,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function loadTaxonomyNames(
  restaurantId: string,
  table:
    | "inventory_suppliers"
    | "inventory_ingredient_categories"
    | "inventory_production_sites"
    | "inventory_brands"
    | "inventory_units",
): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient();
  const map = new Map<string, string>();
  if (!admin) return map;
  const { data } = await admin
    .from(table)
    .select("id,name")
    .eq("restaurant_id", restaurantId);
  for (const row of data ?? []) {
    map.set(row.id as string, row.name as string);
  }
  return map;
}

function getOpenLineContext(
  orders: PurchaseOrder[],
  supplierId: string,
  ingredientId: string,
): { orderId: string | null; lineId: string | null; quantity: number } {
  if (!supplierId.trim()) {
    return { orderId: null, lineId: null, quantity: 0 };
  }
  const o = orders.find((x) => x.supplierId === supplierId && x.status === "open");
  if (!o) return { orderId: null, lineId: null, quantity: 0 };
  const line = o.lines.find((l) => l.ingredientId === ingredientId);
  if (!line) return { orderId: o.id, lineId: null, quantity: 0 };
  return { orderId: o.id, lineId: line.id, quantity: line.quantity };
}

export async function loadDisplayInventory(
  restaurantId: string,
): Promise<DisplayInventoryPayload | null> {
  const [ingredients, orders, suppliers, categories, sites, brands, units] =
    await Promise.all([
      loadIngredientsAdmin(restaurantId),
      loadPurchaseOrdersAdmin(restaurantId),
      loadTaxonomyNames(restaurantId, "inventory_suppliers"),
      loadTaxonomyNames(restaurantId, "inventory_ingredient_categories"),
      loadTaxonomyNames(restaurantId, "inventory_production_sites"),
      loadTaxonomyNames(restaurantId, "inventory_brands"),
      loadTaxonomyNames(restaurantId, "inventory_units"),
    ]);

  if (!ingredients || !orders) return null;

  const supplierOptions: DisplayInventoryFilterOption[] = [];
  for (const [id, name] of suppliers) {
    supplierOptions.push({ id, name });
  }
  supplierOptions.sort((a, b) => a.name.localeCompare(b.name, "de"));

  const categoryOptions: DisplayInventoryFilterOption[] = [];
  for (const [id, name] of categories) {
    categoryOptions.push({ id, name });
  }
  categoryOptions.sort((a, b) => a.name.localeCompare(b.name, "de"));

  const siteOptions: DisplayInventoryFilterOption[] = [];
  for (const [id, name] of sites) {
    siteOptions.push({ id, name });
  }
  siteOptions.sort((a, b) => a.name.localeCompare(b.name, "de"));

  const rows: DisplayInventoryIngredientRow[] = [];
  for (const ing of ingredients) {
    if (ing.active === false) continue;
    const open = getOpenLineContext(orders, ing.supplierId, ing.id);
    rows.push({
      id: ing.id,
      name: ing.name,
      unitId: ing.unit,
      unitLabel: units.get(ing.unit) ?? ing.unit,
      currentStock: ing.currentStock,
      supplierId: ing.supplierId,
      supplierName: suppliers.get(ing.supplierId) ?? ing.supplierId,
      categoryId: ing.categoryId,
      categoryName: categories.get(ing.categoryId) ?? ing.categoryId,
      productionSiteId: ing.productionSiteId,
      productionSiteName: sites.get(ing.productionSiteId) ?? ing.productionSiteId,
      brandId: ing.brandId,
      brandLabel: brands.get(ing.brandId) ?? ing.brandId,
      canOrder: Boolean(ing.supplierId?.trim()),
      orderId: open.orderId,
      orderLineId: open.lineId,
      orderQuantity: open.lineId ? open.quantity : 0,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "de"));

  return {
    ingredients: rows,
    suppliers: supplierOptions,
    categories: categoryOptions,
    productionSites: siteOptions,
  };
}

export function parseDisplayQuantity(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t.replace(",", "."));
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export async function updateDisplayIngredientStock(params: {
  restaurantId: string;
  ingredientId: string;
  nextStock: number;
  actor: StaffActor;
}): Promise<{ ok: true; currentStock: number } | { ok: false; error: string }> {
  const ingredients = await loadIngredientsAdmin(params.restaurantId);
  if (!ingredients) return { ok: false, error: "load_failed" };

  const prev = ingredients.find((x) => x.id === params.ingredientId);
  if (!prev) return { ok: false, error: "not_found" };
  if (prev.currentStock === params.nextStock) {
    return { ok: true, currentStock: params.nextStock };
  }

  const units = await loadTaxonomyNames(params.restaurantId, "inventory_units");
  const unitLabel = units.get(prev.unit) ?? prev.unit;
  const stockLog: IngredientStockLogEntry[] = [...(prev.stockLog ?? [])];
  stockLog.push({
    id: createId(),
    at: new Date().toISOString(),
    userFirstName: params.actor.firstName,
    userLastName: params.actor.lastName,
    kind: "manual_stock",
    fromQuantity: prev.currentStock,
    toQuantity: params.nextStock,
    unitId: prev.unit,
    unitLabel,
  });

  const mapped = ingredients.map((x) =>
    x.id === params.ingredientId
      ? { ...x, currentStock: params.nextStock, stockLog }
      : x,
  );

  const saved = await saveIngredientsAdmin(params.restaurantId, mapped);
  if (!saved.ok) return saved;
  return { ok: true, currentStock: params.nextStock };
}

export async function updateDisplayOrderQuantity(params: {
  restaurantId: string;
  ingredientId: string;
  quantity: number;
  actor: StaffActor;
}): Promise<
  | {
      ok: true;
      orderId: string | null;
      orderLineId: string | null;
      orderQuantity: number;
    }
  | { ok: false; error: string }
> {
  const [ingredients, orders] = await Promise.all([
    loadIngredientsAdmin(params.restaurantId),
    loadPurchaseOrdersAdmin(params.restaurantId),
  ]);
  if (!ingredients || !orders) return { ok: false, error: "load_failed" };

  const ing = ingredients.find((x) => x.id === params.ingredientId);
  if (!ing) return { ok: false, error: "not_found" };
  if (!ing.supplierId?.trim()) {
    return { ok: false, error: "no_supplier" };
  }

  const suppliers = await loadTaxonomyNames(
    params.restaurantId,
    "inventory_suppliers",
  );
  const brands = await loadTaxonomyNames(params.restaurantId, "inventory_brands");
  const units = await loadTaxonomyNames(params.restaurantId, "inventory_units");

  const supplierName = suppliers.get(ing.supplierId) ?? ing.supplierId;
  const brandLabel = brands.get(ing.brandId) ?? ing.brandId;
  const unitLabel = units.get(ing.unit) ?? ing.unit;

  const open = getOpenLineContext(orders, ing.supplierId, ing.id);
  const nextQty = params.quantity;

  if (!Number.isFinite(nextQty) || nextQty < 0) {
    return { ok: false, error: "invalid_quantity" };
  }

  const next: PurchaseOrder[] = structuredClone(orders);

  if (nextQty === open.quantity && open.lineId) {
    return {
      ok: true,
      orderId: open.orderId,
      orderLineId: open.lineId,
      orderQuantity: open.quantity,
    };
  }

  if (!open.lineId && nextQty === 0) {
    return {
      ok: true,
      orderId: open.orderId,
      orderLineId: null,
      orderQuantity: 0,
    };
  }

  if (!open.lineId && nextQty > 0) {
    let order = next.find(
      (o) => o.supplierId === ing.supplierId && o.status === "open",
    );
    if (!order) {
      order = {
        id: createId(),
        supplierId: ing.supplierId,
        supplierName,
        status: "open",
        createdAt: new Date().toISOString(),
        createdBy: `${params.actor.firstName} ${params.actor.lastName}`.trim(),
        deliveryDate: null,
        lines: [],
        log: [],
      };
      next.push(order);
    }

    const logEntry: PurchaseOrderLogAdd = {
      id: createId(),
      at: new Date().toISOString(),
      userFirstName: params.actor.firstName,
      userLastName: params.actor.lastName,
      kind: "add_to_order",
      ingredientId: ing.id,
      ingredientName: ing.name,
      quantity: nextQty,
      unitId: ing.unit,
      unitLabel,
    };
    order.log.push(logEntry);
    const lineId = createId();
    order.lines.push({
      id: lineId,
      ingredientId: ing.id,
      ingredientName: ing.name,
      brandLabel,
      quantity: nextQty,
      unitId: ing.unit,
      unitLabel,
    });

    const saved = await savePurchaseOrdersAdmin(params.restaurantId, next);
    if (!saved.ok) return saved;
    return {
      ok: true,
      orderId: order.id,
      orderLineId: lineId,
      orderQuantity: nextQty,
    };
  }

  if (open.orderId && open.lineId) {
    const o = next.find((x) => x.id === open.orderId);
    if (!o || o.status !== "open") {
      return { ok: false, error: "order_not_open" };
    }
    const l = o.lines.find((x) => x.id === open.lineId);
    if (!l) return { ok: false, error: "line_not_found" };

    const oldQty = l.quantity;
    if (oldQty === nextQty) {
      return {
        ok: true,
        orderId: open.orderId,
        orderLineId: open.lineId,
        orderQuantity: nextQty,
      };
    }

    const logEntry: PurchaseOrderLogQuantityChange = {
      id: createId(),
      at: new Date().toISOString(),
      userFirstName: params.actor.firstName,
      userLastName: params.actor.lastName,
      kind: "quantity_change",
      ingredientId: l.ingredientId,
      ingredientName: l.ingredientName,
      fromQuantity: oldQty,
      toQuantity: nextQty,
      unitId: l.unitId,
      unitLabel: l.unitLabel,
    };
    o.log.push(logEntry);

    if (nextQty === 0) {
      o.lines = o.lines.filter((x) => x.id !== open.lineId);
    } else {
      l.quantity = nextQty;
    }

    const saved = await savePurchaseOrdersAdmin(params.restaurantId, next);
    if (!saved.ok) return saved;

    if (nextQty === 0) {
      return {
        ok: true,
        orderId: open.orderId,
        orderLineId: null,
        orderQuantity: 0,
      };
    }
    return {
      ok: true,
      orderId: open.orderId,
      orderLineId: open.lineId,
      orderQuantity: nextQty,
    };
  }

  return { ok: false, error: "invalid_state" };
}

export async function loadDisplayInventoryLiveRevision(
  restaurantId: string,
): Promise<{ revision: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { revision: "" };

  const { fetchTableLatestUpdatedAt, composeDisplayLiveRevision } = await import(
    "@/lib/display/display-module-live-revision"
  );

  const [ingredients, orders] = await Promise.all([
    fetchTableLatestUpdatedAt(admin, "inventory_ingredients", restaurantId),
    fetchTableLatestUpdatedAt(admin, "inventory_purchase_orders", restaurantId),
  ]);

  return {
    revision: composeDisplayLiveRevision([ingredients, orders]),
  };
}
