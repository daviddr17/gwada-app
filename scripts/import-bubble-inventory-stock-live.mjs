#!/usr/bin/env node
/**
 * Bubble (old.gwada.app) → Live Supabase: Bestände + offene Bestellung(en) für zurschlagd.
 * Ersetzt keine Artikel/Menu — nur current_stock und Bestellungen (merge mit bestehenden).
 *
 * Usage:
 *   BUBBLE_API_TOKEN=… dotenv -e .env.production -- node scripts/import-bubble-inventory-stock-live.mjs
 *   … --dry-run
 *
 * Env: BUBBLE_API_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const BUBBLE_TOKEN = process.env.BUBBLE_API_TOKEN?.trim();
const RESTAURANT_SLUG = "zurschlagd";
const BUBBLE_RESTAURANT_ID = "1612048001800x290697041559945200";
const BUBBLE_BASE = `${(process.env.GWADA_LEGACY_BUBBLE_URL ?? "https://old.gwada.app").replace(/\/$/, "")}/api/1.1/obj`;

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Env ${name} fehlt`);
  return v;
}

function slugId(text) {
  const base = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "item";
}

function bubbleIdToTextId(bubbleId) {
  return `bbl-${String(bubbleId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}`;
}

function unitIdFromLabel(label) {
  return slugId(label);
}

async function bubbleFetchAll(type, constraints) {
  const rows = [];
  let cursor = 0;
  const cParam = constraints
    ? `&constraints=${encodeURIComponent(JSON.stringify(constraints))}`
    : "";
  while (true) {
    const url = `${BUBBLE_BASE}/${type}?limit=100&cursor=${cursor}${cParam}`;
    let data;
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1_500 * 2 ** attempt)));
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Bubble ${type} HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      data = await res.json();
      break;
    }
    if (!data) throw new Error(`Bubble ${type}: Rate-Limit nach Retries`);
    rows.push(...(data?.response?.results ?? []));
    if (!data?.response?.remaining) break;
    cursor += 100;
    await new Promise((r) => setTimeout(r, 120));
  }
  return rows;
}

function buildBubbleOpenOrders({ orderStocks, orderStockItemsById, productsById }) {
  const suppliers = new Map();
  const orders = [];

  for (const o of orderStocks) {
    if (o.Completed) continue;

    const orderId = bubbleIdToTextId(o._id);
    const supplierBubbleId = o.Supplier ?? "default-supplier";
    const supplierId = bubbleIdToTextId(supplierBubbleId);
    suppliers.set(supplierId, `Lieferant ${String(supplierBubbleId).slice(-8)}`);

    const lineMap = new Map();
    for (const itemId of o.Items ?? []) {
      const line = orderStockItemsById.get(itemId);
      if (!line) continue;
      const product = productsById.get(line.Product);
      const ingredientId = product ? bubbleIdToTextId(product._id) : bubbleIdToTextId(line.Product);
      const ingredientName = product?.Name ?? `Produkt ${line.Product?.slice(-8) ?? "?"}`;
      const unitLabel = String(line.Unit ?? product?.Unit ?? "Stück").trim();
      const unitId = unitIdFromLabel(unitLabel);
      const key = `${ingredientId}:${unitId}`;
      const qty = Number(line.Amount ?? 0);
      const existing = lineMap.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        lineMap.set(key, {
          id: bubbleIdToTextId(itemId),
          ingredientId,
          ingredientName,
          brandLabel: product?.Brand ? String(product.Brand) : undefined,
          quantity: qty,
          unitId,
          unitLabel,
        });
      }
    }

    orders.push({
      id: orderId,
      supplierId,
      supplierName: suppliers.get(supplierId) ?? supplierId,
      status: "open",
      createdAt: o.Date ?? o["Created Date"] ?? new Date().toISOString(),
      createdBy: "Bubble-Import",
      deliveryDate: o.DeliverDate ? new Date(o.DeliverDate).toISOString().slice(0, 10) : null,
      lines: [...lineMap.values()],
      log: [],
    });
  }

  return orders;
}

function latestStockByProduct(productStocks) {
  const map = new Map();
  for (const s of productStocks) {
    const pid = s.Product;
    if (!pid) continue;
    const date = new Date(s.Date ?? s["Created Date"] ?? 0).getTime();
    const prev = map.get(pid);
    if (!prev || date >= prev.date) {
      map.set(pid, { stock: Number(s.Stock ?? 0), date });
    }
  }
  return map;
}

async function loadLiveOrders(admin, restaurantId) {
  const { data: orders, error: e1 } = await admin
    .from("inventory_purchase_orders")
    .select(
      "id,supplier_id,supplier_name,status,created_at,created_by,created_by_user_source,delivery_date",
    )
    .eq("restaurant_id", restaurantId);
  if (e1) throw new Error(`live orders: ${e1.message}`);

  const { data: lines, error: e2 } = await admin
    .from("inventory_purchase_order_lines")
    .select(
      "order_id,id,ingredient_id,ingredient_name,brand_label,quantity,unit_id,unit_label,delivered_at",
    )
    .eq("restaurant_id", restaurantId);
  if (e2) throw new Error(`live lines: ${e2.message}`);

  const { data: logRows, error: e3 } = await admin
    .from("inventory_purchase_order_log_entries")
    .select("order_id,sort_order,entry")
    .eq("restaurant_id", restaurantId)
    .order("order_id")
    .order("sort_order");
  if (e3) throw new Error(`live log: ${e3.message}`);

  const linesByOrder = new Map();
  for (const row of lines ?? []) {
    const arr = linesByOrder.get(row.order_id) ?? [];
    arr.push({
      id: row.id,
      ingredientId: row.ingredient_id,
      ingredientName: row.ingredient_name,
      brandLabel: row.brand_label ?? undefined,
      quantity: Number(row.quantity),
      unitId: row.unit_id,
      unitLabel: row.unit_label,
      deliveredAt: row.delivered_at ?? undefined,
    });
    linesByOrder.set(row.order_id, arr);
  }

  const logByOrder = new Map();
  for (const row of logRows ?? []) {
    const arr = logByOrder.get(row.order_id) ?? [];
    arr.push(row.entry);
    logByOrder.set(row.order_id, arr);
  }

  return (orders ?? []).map((o) => ({
    id: o.id,
    supplierId: o.supplier_id,
    supplierName: o.supplier_name,
    status: o.status,
    createdAt: o.created_at,
    createdBy: o.created_by ?? "",
    ...(o.created_by_user_source ? { createdByUserSource: o.created_by_user_source } : {}),
    deliveryDate: o.delivery_date,
    lines: linesByOrder.get(o.id) ?? [],
    log: logByOrder.get(o.id) ?? [],
  }));
}

function pickNewestOpenOrder(orders) {
  if (!orders.length) return null;
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

/** Nur die neueste Bubble-Bestellung importieren; veraltete Live-Offene schließen. */
function mergeOrders(liveOrders, bubbleOpenOrders) {
  const bubbleOpen = pickNewestOpenOrder(bubbleOpenOrders);
  const bubbleOpenIds = new Set(bubbleOpen ? [bubbleOpen.id] : []);

  const merged = liveOrders.map((o) => {
    if (o.status !== "open") return o;
    if (bubbleOpenIds.has(o.id)) return o;
    return { ...o, status: "closed" };
  });

  if (bubbleOpen && !merged.some((o) => o.id === bubbleOpen.id)) {
    merged.push(bubbleOpen);
  }

  return merged;
}

async function main() {
  if (!BUBBLE_TOKEN) throw new Error("BUBBLE_API_TOKEN fehlt");

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(DRY_RUN ? "=== DRY-RUN ===" : "=== IMPORT Bestand + offene Bestellung ===");
  console.log(`Restaurant: ${RESTAURANT_SLUG}`);

  const restaurantConstraint = [
    { key: "Restaurant", constraint_type: "equals", value: BUBBLE_RESTAURANT_ID },
  ];

  console.log("Bubble laden …");
  const [products, productStocks, orderStocks, orderStockItems] = await Promise.all([
    bubbleFetchAll("product", restaurantConstraint),
    bubbleFetchAll("productstock", restaurantConstraint),
    bubbleFetchAll("orderstock", restaurantConstraint),
    bubbleFetchAll("orderstockitem", restaurantConstraint),
  ]);

  const productsById = new Map(products.map((p) => [p._id, p]));
  const orderStockItemsById = new Map(orderStockItems.map((r) => [r._id, r]));
  const stockMap = latestStockByProduct(productStocks);
  const bubbleOpenOrders = buildBubbleOpenOrders({
    orderStocks,
    orderStockItemsById,
    productsById,
  });

  console.log("Bubble:", {
    products: products.length,
    productStocks: productStocks.length,
    orderStocksTotal: orderStocks.length,
    openOrders: bubbleOpenOrders.length,
    openOrderLines: bubbleOpenOrders.reduce((n, o) => n + o.lines.length, 0),
  });

  for (const o of bubbleOpenOrders) {
    console.log(
      `  offen (Bubble): ${o.id} · ${o.supplierName} · ${o.lines.length} Positionen · ${o.createdAt}`,
    );
  }
  const bubbleOpen = pickNewestOpenOrder(bubbleOpenOrders);
  if (bubbleOpenOrders.length > 1 && bubbleOpen) {
    console.log(
      `  → importiert wird nur die neueste: ${bubbleOpen.id} (${bubbleOpen.lines.length} Positionen)`,
    );
  }

  const { data: restaurant, error: rErr } = await admin
    .from("restaurants")
    .select("id, slug, name")
    .eq("slug", RESTAURANT_SLUG)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!restaurant?.id) throw new Error(`Restaurant ${RESTAURANT_SLUG} nicht auf Live`);

  const { data: liveIngredients, error: ingErr } = await admin
    .from("inventory_ingredients")
    .select("id, name, current_stock")
    .eq("restaurant_id", restaurant.id);
  if (ingErr) throw new Error(ingErr.message);

  const liveById = new Map((liveIngredients ?? []).map((i) => [i.id, i]));
  const stockUpdates = [];
  for (const p of products) {
    const id = bubbleIdToTextId(p._id);
    const live = liveById.get(id);
    if (!live) continue;
    const nextStock = stockMap.get(p._id)?.stock ?? 0;
    if (Number(live.current_stock) !== nextStock) {
      stockUpdates.push({ id, name: live.name, from: Number(live.current_stock), to: nextStock });
    }
  }

  const liveOrders = await loadLiveOrders(admin, restaurant.id);
  const liveOpen = liveOrders.filter((o) => o.status === "open");
  const mergedOrders = mergeOrders(liveOrders, bubbleOpenOrders);

  console.log("Live:", {
    ingredients: liveIngredients?.length ?? 0,
    ordersTotal: liveOrders.length,
    openOrders: liveOpen.length,
    stockChanges: stockUpdates.length,
    ordersAfterMerge: mergedOrders.length,
    openAfterMerge: mergedOrders.filter((o) => o.status === "open").length,
  });

  if (stockUpdates.length) {
    console.log(`Bestands-Updates (Auszug, max 10 von ${stockUpdates.length}):`);
    for (const u of stockUpdates.slice(0, 10)) {
      console.log(`  ${u.name}: ${u.from} → ${u.to}`);
    }
  }

  if (DRY_RUN) {
    console.log("Dry-run fertig — keine DB-Änderungen.");
    return;
  }

  let stockOk = 0;
  for (const u of stockUpdates) {
    const { error } = await admin
      .from("inventory_ingredients")
      .update({ current_stock: u.to })
      .eq("restaurant_id", restaurant.id)
      .eq("id", u.id);
    if (error) throw new Error(`stock ${u.id}: ${error.message}`);
    stockOk += 1;
  }
  console.log(`✓ Bestand aktualisiert: ${stockOk} Zutaten`);

  const ordersChanged =
    mergedOrders.length !== liveOrders.length ||
    (bubbleOpen &&
      (() => {
        const liveMatch = liveOrders.find((l) => l.id === bubbleOpen.id);
        if (!liveMatch) return true;
        if (liveMatch.lines.length !== bubbleOpen.lines.length) return true;
        return JSON.stringify(liveMatch.lines) !== JSON.stringify(bubbleOpen.lines);
      })()) ||
    liveOpen.some((o) => o.status === "open" && o.id !== bubbleOpen?.id) ||
    liveOpen.length !== mergedOrders.filter((o) => o.status === "open").length;

  if (ordersChanged) {
    const { error: poErr } = await admin.rpc("inventory_replace_purchase_orders", {
      p_restaurant_id: restaurant.id,
      p_orders: mergedOrders,
    });
    if (poErr) throw new Error(`inventory_replace_purchase_orders: ${poErr.message}`);
    console.log(
      `✓ Bestellungen synchronisiert: ${mergedOrders.length} gesamt, ${mergedOrders.filter((o) => o.status === "open").length} offen`,
    );
  } else {
    console.log("✓ Bestellungen unverändert — kein Replace nötig.");
  }

  console.log("Import abgeschlossen:", restaurant.name);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
