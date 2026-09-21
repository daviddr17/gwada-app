import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const STATUSES = ["open", "ordered", "closed"] as const;
type PurchaseOrderApiStatus = (typeof STATUSES)[number];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_OFFSET = 10_000;

export type PurchaseOrdersApiQuery = {
  id: string | null;
  statuses: PurchaseOrderApiStatus[] | null;
  supplierId: string | null;
  limit: number;
  offset: number;
};

export type PurchaseOrderApiLine = {
  id: string;
  ingredientId: string;
  articleNumber: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  deliveryStatus: "delivered" | "not_delivered" | "partial" | null;
  deliveredQuantity: number | null;
  deliveredAt: string | null;
  deliveryNote: string | null;
};

export type PurchaseOrderApiOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderApiStatus;
  createdAt: string;
  statusUpdatedAt: string | null;
  deliveryDate: string | null;
  lines: PurchaseOrderApiLine[];
};

export type PurchaseOrdersApiPayload = {
  orders: PurchaseOrderApiOrder[];
  limit: number;
  offset: number;
  total: number;
};

type PurchaseOrderLineRow = {
  order_id: string;
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  brand_label: string | null;
  quantity: number | string;
  unit_label: string;
  delivered_at: string | null;
  delivery_status?: string | null;
  delivered_quantity?: number | string | null;
  delivery_note?: string | null;
};

type ParseResult =
  | { ok: true; query: PurchaseOrdersApiQuery }
  | { ok: false; error: "invalid_request" };

export function parsePurchaseOrdersApiQuery(url: URL): ParseResult {
  const id = url.searchParams.get("id")?.trim() || null;
  if (id && id.length > 80) return { ok: false, error: "invalid_request" };

  const supplierId = url.searchParams.get("supplierId")?.trim() || null;
  if (supplierId && supplierId.length > 80) {
    return { ok: false, error: "invalid_request" };
  }

  const statusRaw = url.searchParams.get("status")?.trim() ?? "";
  let statuses: PurchaseOrderApiStatus[] | null = null;
  if (statusRaw) {
    const parts = statusRaw.split(",").map((part) => part.trim()).filter(Boolean);
    const unique: PurchaseOrderApiStatus[] = [];
    for (const part of parts) {
      if (!isStatus(part)) return { ok: false, error: "invalid_request" };
      if (!unique.includes(part)) unique.push(part);
    }
    if (unique.length === 0) return { ok: false, error: "invalid_request" };
    statuses = unique;
  }

  const limit = parseBoundedInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseBoundedInt(url.searchParams.get("offset"), 0, 0, MAX_OFFSET);
  if (limit == null || offset == null) return { ok: false, error: "invalid_request" };

  return {
    ok: true,
    query: { id, statuses, supplierId, limit, offset },
  };
}

function isStatus(value: string): value is PurchaseOrderApiStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function parseBoundedInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (raw == null || raw.trim() === "") return fallback;
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asDeliveryStatus(
  value: unknown,
): PurchaseOrderApiLine["deliveryStatus"] {
  if (value === "delivered" || value === "not_delivered" || value === "partial") {
    return value;
  }
  return null;
}

export async function fetchPurchaseOrdersForApi(
  restaurantId: string,
  query: PurchaseOrdersApiQuery,
): Promise<
  | { ok: true; data: PurchaseOrdersApiPayload }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured", status: 503 };

  let ordersQuery = admin
    .from("inventory_purchase_orders")
    .select(
      "id, supplier_id, supplier_name, status, status_updated_at, created_at, delivery_date",
      { count: "exact" },
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (query.id) {
    ordersQuery = ordersQuery.eq("id", query.id);
  } else {
    if (query.statuses) ordersQuery = ordersQuery.in("status", query.statuses);
    if (query.supplierId) ordersQuery = ordersQuery.eq("supplier_id", query.supplierId);
    ordersQuery = ordersQuery.range(query.offset, query.offset + query.limit - 1);
  }

  const { data: orderRows, error: ordersError, count } = await ordersQuery;
  if (ordersError) {
    console.warn("[gwada] purchase-orders api", ordersError.message);
    return { ok: false, error: "load_failed", status: 500 };
  }

  const rows = orderRows ?? [];
  if (query.id && rows.length === 0) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const orderIds = rows.map((row) => row.id);
  const linesByOrder = new Map<string, PurchaseOrderApiLine[]>();

  if (orderIds.length > 0) {
    const { data: lineRowsRaw, error: linesError } = await admin
      .from("inventory_purchase_order_lines")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .in("order_id", orderIds);

    if (linesError) {
      console.warn("[gwada] purchase-orders api lines", linesError.message);
      return { ok: false, error: "load_failed", status: 500 };
    }

    const lineRows = (lineRowsRaw ?? []) as PurchaseOrderLineRow[];
    const ingredientIds = [
      ...new Set(lineRows.map((row) => row.ingredient_id).filter(Boolean)),
    ];
    const articleByIngredient = new Map<string, string | null>();
    if (ingredientIds.length > 0) {
      const { data: ingredients, error: ingredientsError } = await admin
        .from("inventory_ingredients")
        .select("id, article_number")
        .eq("restaurant_id", restaurantId)
        .in("id", ingredientIds);
      if (ingredientsError) {
        console.warn("[gwada] purchase-orders api articles", ingredientsError.message);
        return { ok: false, error: "load_failed", status: 500 };
      }
      for (const ingredient of ingredients ?? []) {
        const article = ingredient.article_number?.trim() || null;
        articleByIngredient.set(ingredient.id, article);
      }
    }

    for (const row of lineRows) {
      const line: PurchaseOrderApiLine = {
        id: row.id,
        ingredientId: row.ingredient_id,
        articleNumber: articleByIngredient.get(row.ingredient_id) ?? null,
        name: row.ingredient_name,
        brand: row.brand_label?.trim() || null,
        quantity: asNumber(row.quantity),
        unit: row.unit_label,
        deliveryStatus: asDeliveryStatus(row.delivery_status),
        deliveredQuantity: asNullableNumber(row.delivered_quantity),
        deliveredAt: row.delivered_at,
        deliveryNote: row.delivery_note?.trim() || null,
      };
      const list = linesByOrder.get(row.order_id) ?? [];
      list.push(line);
      linesByOrder.set(row.order_id, list);
    }
  }

  const orders: PurchaseOrderApiOrder[] = rows.map((row) => {
    const status = isStatus(row.status) ? row.status : "open";
    const lines = (linesByOrder.get(row.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id),
    );
    return {
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      status,
      createdAt: row.created_at,
      statusUpdatedAt: row.status_updated_at || null,
      deliveryDate: row.delivery_date,
      lines,
    };
  });

  return {
    ok: true,
    data: {
      orders,
      limit: query.id ? orders.length : query.limit,
      offset: query.id ? 0 : query.offset,
      total: query.id ? orders.length : (count ?? orders.length),
    },
  };
}
