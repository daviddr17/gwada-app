#!/usr/bin/env node
/**
 * Bubble (old.gwada.app) → Supabase (gwada.app) für Restaurant zurschlagd.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=… dotenv -e .env.production -- node scripts/migrate-bubble-zurschlagd.mjs
 *   … --dry-run   (nur lesen + Zusammenfassung, keine DB-Schreibzugriffe)
 *
 * Env:
 *   BUBBLE_API_TOKEN          (Pflicht)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GWADA_ADMIN_EMAIL         (default: dreyer@techlion.de)
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const BUBBLE_TOKEN = process.env.BUBBLE_API_TOKEN?.trim();
const ADMIN_EMAIL = (process.env.GWADA_ADMIN_EMAIL ?? "dreyer@techlion.de").trim().toLowerCase();
const RESTAURANT_SLUG = "zurschlagd";
const BUBBLE_RESTAURANT_ID = "1612048001800x290697041559945200";
const BUBBLE_BASE = "https://old.gwada.app/api/1.1/obj";
const RESERVATION_DURATION_MIN = 120;

const TIME_TYPE_MAP = {
  Arbeitszeit: "work",
  Pause: "break",
  Urlaubstag: "vacation",
  Request: "other",
};

const RES_STATUS_MAP = {
  Confirmed: "confirmed",
  Rejected: "declined",
  Canceled: "cancelled",
  Unconfirmed: "pending",
};

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

/** Bubble „Supplier“ ist oft Kundennummer, manchmal schon Klarname. */
function supplierDisplayNameFromBubbleField(supplierField) {
  const raw = String(supplierField ?? "").trim();
  if (!raw || raw === "default-supplier") return "Ohne Lieferant";
  if (/^\d+x\d+$/i.test(raw)) return `Lieferant ${raw.slice(-8)}`;
  if (/^\d+$/.test(raw)) return `Kunden-Nr. ${raw}`;
  return raw;
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
        const waitMs = Math.min(30_000, 1_500 * 2 ** attempt);
        await new Promise((r) => setTimeout(r, waitMs));
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
    const batch = data?.response?.results ?? [];
    rows.push(...batch);
    if (!data?.response?.remaining) break;
    cursor += 100;
    await new Promise((r) => setTimeout(r, 120));
  }
  return rows;
}

async function bubbleFetchByIds(type, ids) {
  const map = new Map();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 20) {
    const chunk = unique.slice(i, i + 20);
    for (const id of chunk) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await fetch(`${BUBBLE_BASE}/${type}/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` },
        });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1_500 * 2 ** attempt));
          continue;
        }
        if (!res.ok) break;
        const data = await res.json();
        if (data?.response) map.set(id, data.response);
        break;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    console.log(`  ${type}: ${Math.min(i + 20, unique.length)}/${unique.length}`);
  }
  return map;
}

function parseBirthday(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function unitIdFromLabel(label) {
  return slugId(label);
}

async function resolveAdminContext(admin, restaurantId) {
  const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersErr) throw new Error(usersErr.message);

  const authUser = usersData.users.find(
    (u) => u.email?.trim().toLowerCase() === ADMIN_EMAIL,
  );
  if (!authUser) {
    throw new Error(`Admin-User ${ADMIN_EMAIL} nicht in auth.users gefunden`);
  }

  const adminProfileId = authUser.id;

  const { data: ownerPos } = await admin
    .from("restaurant_positions")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("slug", "owner")
    .maybeSingle();

  const { data: employeeRow } = await admin
    .from("restaurant_employees")
    .select("id, staff_id, position_id, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", adminProfileId)
    .maybeSingle();

  let adminStaffId = employeeRow?.staff_id ?? null;
  if (!adminStaffId) {
    const { data: staffByProfile } = await admin
      .from("restaurant_staff")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("profile_id", adminProfileId)
      .maybeSingle();
    adminStaffId = staffByProfile?.id ?? null;
  }

  return {
    adminProfileId,
    adminEmployeeId: employeeRow?.id ?? null,
    adminStaffId,
    ownerPositionId: ownerPos?.id ?? null,
  };
}

async function ensureAdminAccess(admin, restaurantId, adminCtx) {
  if (DRY_RUN) {
    console.log(`[dry-run] Admin-Zugang sichern für ${ADMIN_EMAIL}`);
    return;
  }

  await admin
    .from("restaurants")
    .update({ owner_profile_id: adminCtx.adminProfileId })
    .eq("id", restaurantId);

  if (adminCtx.ownerPositionId) {
    if (adminCtx.adminEmployeeId) {
      await admin
        .from("restaurant_employees")
        .update({
          position_id: adminCtx.ownerPositionId,
          is_active: true,
          role: "owner",
        })
        .eq("id", adminCtx.adminEmployeeId);
    } else {
      await admin.from("restaurant_employees").insert({
        restaurant_id: restaurantId,
        profile_id: adminCtx.adminProfileId,
        position_id: adminCtx.ownerPositionId,
        role: "owner",
        is_active: true,
        staff_id: adminCtx.adminStaffId,
      });
    }
  }
}

async function clearModuleData(admin, restaurantId, adminCtx) {
  const log = (msg) => console.log(DRY_RUN ? `[dry-run] ${msg}` : msg);
  log("Lösche bestehende Modul-Daten (ersetzen)…");

  if (DRY_RUN) return;

  const { data: menuItems } = await admin
    .from("menu_items")
    .select("id")
    .eq("restaurant_id", restaurantId);
  const menuItemIds = (menuItems ?? []).map((r) => r.id);
  if (menuItemIds.length) {
    await admin.from("menu_item_recipe_lines").delete().in("menu_item_id", menuItemIds);
    await admin.from("menu_item_tags").delete().in("menu_item_id", menuItemIds);
    await admin.from("menu_item_allergens").delete().in("menu_item_id", menuItemIds);
  }
  await admin.from("menu_items").delete().eq("restaurant_id", restaurantId);
  await admin.from("menu_categories").delete().eq("restaurant_id", restaurantId);
  await admin.from("menu_tags").delete().eq("restaurant_id", restaurantId);
  await admin.from("menu_allergens").delete().eq("restaurant_id", restaurantId);

  await admin.rpc("inventory_replace_purchase_orders", {
    p_restaurant_id: restaurantId,
    p_orders: [],
  });
  await admin.rpc("inventory_replace_ingredients", {
    p_restaurant_id: restaurantId,
    p_ingredients: [],
  });
  for (const table of [
    "inventory_stock_log_entries",
    "inventory_suppliers",
    "inventory_brands",
    "inventory_ingredient_categories",
    "inventory_production_sites",
    "inventory_units",
  ]) {
    await admin.from(table).delete().eq("restaurant_id", restaurantId);
  }

  await admin.from("reservations").delete().eq("restaurant_id", restaurantId);
  await admin.from("restaurant_reservation_counters").delete().eq("restaurant_id", restaurantId);

  const { data: staffRows } = await admin
    .from("restaurant_staff")
    .select("id, profile_id")
    .eq("restaurant_id", restaurantId);

  const staffIdsToDelete = (staffRows ?? [])
    .filter((s) => s.id !== adminCtx.adminStaffId && s.profile_id !== adminCtx.adminProfileId)
    .map((s) => s.id);

  await admin
    .from("restaurant_staff_work_entry_log_entries")
    .delete()
    .eq("restaurant_id", restaurantId);
  await admin.from("restaurant_staff_work_entries").delete().eq("restaurant_id", restaurantId);

  if (staffIdsToDelete.length) {
    await admin.from("restaurant_staff_time_sessions").delete().in("staff_id", staffIdsToDelete);
    await admin.from("restaurant_staff_contracts").delete().in("staff_id", staffIdsToDelete);
    await admin.from("restaurant_staff_invites").delete().in("staff_id", staffIdsToDelete);
    await admin.from("restaurant_staff").delete().in("id", staffIdsToDelete);
  }

  await admin
    .from("restaurant_employees")
    .delete()
    .eq("restaurant_id", restaurantId)
    .neq("profile_id", adminCtx.adminProfileId);
}

function buildMenuPayload({ dishCategories, beverageCategories, dishes, beverages }) {
  const categoryIdByBubble = new Map();
  const categories = [];
  let sort = 0;

  for (const row of [...dishCategories, ...beverageCategories]) {
    const bubbleId = row._id;
    const catUuid = crypto.randomUUID();
    categoryIdByBubble.set(bubbleId, catUuid);
    categories.push({
      id: catUuid,
      restaurant_id: null,
      name: String(row.Name ?? "Kategorie").trim(),
      sort_order: Number(row.Number ?? sort),
      is_active: row.Active !== false && row.Old !== true,
    });
    sort += 1;
  }

  const items = [];
  for (const row of [...dishes, ...beverages]) {
    const catBubble = row.Category;
    const categoryId = categoryIdByBubble.get(catBubble);
    if (!categoryId) continue;
    items.push({
      id: crypto.randomUUID(),
      restaurant_id: null,
      category_id: categoryId,
      name: String(row.Name ?? "Artikel").trim(),
      description: String(row.Description ?? "").trim(),
      price: Number(row.Price ?? 0),
      image_url: "",
      is_active: row.Active !== false && row.Old !== true,
      list_number:
        row.Number != null && Number.isFinite(Number(row.Number))
          ? Number(row.Number)
          : null,
    });
  }

  return { categories, items };
}

function buildInventoryPayload({
  products,
  productCategories,
  productionPoints,
  productStocks,
  orderStocks,
  orderStockItemsById,
  productsById,
}) {
  const defaultSiteId =
    productionPoints[0]?._id != null
      ? bubbleIdToTextId(productionPoints[0]._id)
      : "default-site";
  const defaultSiteName = productionPoints[0]?.Name ?? "Küche";

  const sites = productionPoints.map((p, idx) => ({
    id: bubbleIdToTextId(p._id),
    name: String(p.Name ?? `Bereich ${idx + 1}`).trim(),
    sort_order: Number(p.Number ?? idx),
    active: true,
  }));
  if (!sites.length) {
    sites.push({ id: defaultSiteId, name: defaultSiteName, sort_order: 0, active: true });
  }

  const categories = productCategories.map((c, idx) => ({
    id: bubbleIdToTextId(c._id),
    name: String(c.Name ?? `Kategorie ${idx + 1}`).trim(),
    sort_order: Number(c.Number ?? idx),
    active: true,
  }));
  if (!categories.length) {
    categories.push({ id: "default-cat", name: "Allgemein", sort_order: 0, active: true });
  }

  const units = new Map();
  const brands = new Map();
  const suppliers = new Map();

  const latestStockByProduct = new Map();
  for (const s of productStocks) {
    const pid = s.Product;
    if (!pid) continue;
    const prev = latestStockByProduct.get(pid);
    const date = new Date(s.Date ?? s["Created Date"] ?? 0).getTime();
    if (!prev || date >= prev.date) {
      latestStockByProduct.set(pid, { stock: Number(s.Stock ?? 0), date });
    }
  }

  const ingredients = [];
  for (const p of products) {
    const id = bubbleIdToTextId(p._id);
    const unitLabel = String(p.Unit ?? "Stück").trim();
    const unitId = unitIdFromLabel(unitLabel);
    units.set(unitId, unitLabel);

    const brandLabel = String(p.Brand ?? "—").trim() || "—";
    const brandId = slugId(brandLabel);
    brands.set(brandId, brandLabel);

    const supplierBubbleId = p.Supplier ?? "default-supplier";
    const supplierId = bubbleIdToTextId(supplierBubbleId);
    suppliers.set(supplierId, supplierDisplayNameFromBubbleField(supplierBubbleId));

    const siteBubble = p.ProductionPoints?.[0] ?? productionPoints[0]?._id;
    const productionSiteId = siteBubble ? bubbleIdToTextId(siteBubble) : defaultSiteId;

    const catBubble = p.ProductCategory ?? productCategories[0]?._id;
    const categoryId = catBubble ? bubbleIdToTextId(catBubble) : categories[0].id;

    ingredients.push({
      id,
      name: String(p.Name ?? "Artikel").trim(),
      unit: unitId,
      currentStock: latestStockByProduct.get(p._id)?.stock ?? 0,
      supplierId,
      categoryId,
      productionSiteId,
      brandId,
      active: true,
      stockLog: [],
    });
  }

  const orders = [];
  for (const o of orderStocks) {
    const orderId = bubbleIdToTextId(o._id);
    const supplierBubbleId = o.Supplier ?? "default-supplier";
    const supplierId = bubbleIdToTextId(supplierBubbleId);
    const supplierName = suppliers.get(supplierId) ?? supplierId;
    suppliers.set(supplierId, supplierName);

    const lineMap = new Map();
    for (const itemId of o.Items ?? []) {
      const line = orderStockItemsById.get(itemId);
      if (!line) continue;
      const product = productsById.get(line.Product);
      const ingredientId = product ? bubbleIdToTextId(product._id) : bubbleIdToTextId(line.Product);
      const ingredientName = product?.Name ?? `Produkt ${line.Product?.slice(-8) ?? "?"}`;
      const unitLabel = String(line.Unit ?? product?.Unit ?? "Stück").trim();
      const unitId = unitIdFromLabel(unitLabel);
      units.set(unitId, unitLabel);
      const key = `${ingredientId}:${unitId}`;
      const qty = Number(line.Amount ?? 0);
      const existing = lineMap.get(key);
      if (existing) {
        existing.quantity += qty;
        if (line.Delivered && !existing.deliveredAt) {
          existing.deliveredAt = o.Completed ?? line["Modified Date"] ?? o.Date;
        }
      } else {
        lineMap.set(key, {
          id: bubbleIdToTextId(itemId),
          ingredientId,
          ingredientName,
          brandLabel: product?.Brand ? String(product.Brand) : undefined,
          quantity: qty,
          unitId,
          unitLabel,
          deliveredAt: line.Delivered ? (o.Completed ?? line["Modified Date"] ?? o.Date) : undefined,
        });
      }
    }

    orders.push({
      id: orderId,
      supplierId,
      supplierName,
      status: o.Completed ? "closed" : "open",
      createdAt: o.Date ?? o["Created Date"] ?? new Date().toISOString(),
      createdBy: "Bubble-Import",
      deliveryDate: o.DeliverDate ? new Date(o.DeliverDate).toISOString().slice(0, 10) : null,
      lines: [...lineMap.values()],
      log: [],
    });
  }

  return {
    taxonomy: {
      sites,
      categories,
      units: [...units.entries()].map(([id, name], idx) => ({
        id,
        name,
        sort_order: idx,
        active: true,
      })),
      brands: [...brands.entries()].map(([id, name], idx) => ({
        id,
        name,
        sort_order: idx,
        active: true,
      })),
      suppliers: [...suppliers.entries()].map(([id, name], idx) => ({
        id,
        name,
        sort_order: idx,
        active: true,
      })),
    },
    ingredients,
    orders,
  };
}

async function importMenu(admin, restaurantId, menuPayload) {
  if (!menuPayload.categories.length) return { categories: 0, items: 0 };

  const categories = menuPayload.categories.map((c) => ({
    ...c,
    restaurant_id: restaurantId,
  }));
  const { error: catErr } = await admin.from("menu_categories").insert(categories);
  if (catErr) throw new Error(`menu_categories: ${catErr.message}`);

  const items = menuPayload.items.map((i) => ({
    ...i,
    restaurant_id: restaurantId,
  }));
  const chunkSize = 100;
  for (let i = 0; i < items.length; i += chunkSize) {
    const { error } = await admin.from("menu_items").insert(items.slice(i, i + chunkSize));
    if (error) throw new Error(`menu_items: ${error.message}`);
  }
  return { categories: categories.length, items: items.length };
}

async function importInventory(admin, restaurantId, inv) {
  const taxRows = (table, rows, mapper) =>
    rows.map((r) => ({ restaurant_id: restaurantId, ...mapper(r) }));

  const inserts = [
    ["inventory_production_sites", taxRows("inventory_production_sites", inv.taxonomy.sites, (r) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort_order,
      is_active: r.active !== false,
    }))],
    ["inventory_ingredient_categories", taxRows("inventory_ingredient_categories", inv.taxonomy.categories, (r) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort_order,
      is_active: r.active !== false,
    }))],
    ["inventory_units", taxRows("inventory_units", inv.taxonomy.units, (r) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort_order,
      is_active: r.active !== false,
    }))],
    ["inventory_brands", taxRows("inventory_brands", inv.taxonomy.brands, (r) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort_order,
      is_active: r.active !== false,
    }))],
    ["inventory_suppliers", taxRows("inventory_suppliers", inv.taxonomy.suppliers, (r) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort_order,
      is_active: r.active !== false,
    }))],
  ];

  for (const [table, rows] of inserts) {
    if (!rows.length) continue;
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  const { error: ingErr } = await admin.rpc("inventory_replace_ingredients", {
    p_restaurant_id: restaurantId,
    p_ingredients: inv.ingredients,
  });
  if (ingErr) throw new Error(`inventory_replace_ingredients: ${ingErr.message}`);

  const { error: poErr } = await admin.rpc("inventory_replace_purchase_orders", {
    p_restaurant_id: restaurantId,
    p_orders: inv.orders,
  });
  if (poErr) throw new Error(`inventory_replace_purchase_orders: ${poErr.message}`);

  return {
    ingredients: inv.ingredients.length,
    orders: inv.orders.length,
    suppliers: inv.taxonomy.suppliers.length,
  };
}

async function importStaff(admin, restaurantId, { employees, timeTypes, employeeTimes }, adminCtx) {
  const timeTypeById = new Map(timeTypes.map((t) => [t._id, t.Name]));
  const staffIdByBubbleEmployee = new Map();
  let inserted = 0;
  let pinsSet = 0;

  for (const e of employees) {
    const email = e.Email?.trim().toLowerCase() ?? null;
    if (email === ADMIN_EMAIL) continue;

    const row = {
      restaurant_id: restaurantId,
      given_name: String(e.FirstName ?? "—").trim() || "—",
      family_name: String(e.LastName ?? "—").trim() || "—",
      birth_date: parseBirthday(e.Birthday),
      email: e.Email?.trim() || null,
      phone: e.Phone?.trim() || null,
      is_active: e.Active !== false,
      profile_id: null,
      employee_id: null,
      position_tag_id: null,
      restaurant_position_id: null,
    };

    const { data, error } = await admin.from("restaurant_staff").insert(row).select("id").single();
    if (error) throw new Error(`restaurant_staff ${e.FirstName} ${e.LastName}: ${error.message}`);
    staffIdByBubbleEmployee.set(e._id, data.id);
    inserted += 1;

    const pin = e.PIN != null ? String(e.PIN).replace(/\D/g, "") : "";
    if (pin.length >= 4) {
      const { error: pinErr } = await admin.rpc("set_restaurant_staff_display_pin", {
        p_staff_id: data.id,
        p_pin: pin,
      });
      if (!pinErr) pinsSet += 1;
    }
  }

  const workRows = [];
  for (const t of employeeTimes) {
    const staffId = staffIdByBubbleEmployee.get(t.Employee);
    if (!staffId) continue;
    const typeName = timeTypeById.get(t.Type) ?? "Arbeitszeit";
    const entryType = TIME_TYPE_MAP[typeName] ?? "other";
    const startsAt = t.Start ?? t.Range?.[0];
    const endsAt = t.End ?? t.Range?.[1];
    if (!startsAt || !endsAt) continue;
    if (new Date(endsAt) <= new Date(startsAt)) continue;

    workRows.push({
      restaurant_id: restaurantId,
      staff_id: staffId,
      entry_type: entryType,
      starts_at: startsAt,
      ends_at: endsAt,
      note: typeName === "Request" ? "Request (Bubble)" : null,
      is_open: false,
    });
  }

  for (let i = 0; i < workRows.length; i += 200) {
    const { error } = await admin
      .from("restaurant_staff_work_entries")
      .insert(workRows.slice(i, i + 200));
    if (error) throw new Error(`restaurant_staff_work_entries: ${error.message}`);
  }

  return { staff: inserted, workEntries: workRows.length, pinsSet };
}

async function importReservations(admin, restaurantId, reservations, statusByCode) {
  const sorted = [...reservations].sort(
    (a, b) =>
      new Date(a["Created Date"] ?? a.Date).getTime() -
      new Date(b["Created Date"] ?? b.Date).getTime(),
  );

  const rows = sorted.map((r, idx) => {
    const code = RES_STATUS_MAP[r.Status] ?? "pending";
    const statusId = statusByCode.get(code);
    if (!statusId) throw new Error(`Unbekannter Reservierungsstatus: ${r.Status}`);
    const startsAt = r.Date;
    const endsAt = new Date(new Date(startsAt).getTime() + RESERVATION_DURATION_MIN * 60_000).toISOString();
    return {
      restaurant_id: restaurantId,
      dining_table_id: null,
      guest_profile_id: null,
      guest_name: `${r.FirstName ?? ""} ${r.LastName ?? ""}`.trim() || "Gast",
      guest_email: r.Email?.trim() || null,
      guest_phone: r.Phone?.trim() || null,
      party_size: Math.min(50, Math.max(1, Number(r.NumberPersons ?? 2) || 2)),
      starts_at: startsAt,
      ends_at: endsAt,
      status_id: statusId,
      notes: r.Notes?.trim?.() || r.Note?.trim?.() || null,
      reservation_number: idx + 1,
      guest_first_name: String(r.FirstName ?? "Gast").trim() || "Gast",
      guest_last_name: String(r.LastName ?? "").trim() || "—",
      notify_email: Boolean(r.Email),
      notify_whatsapp: false,
      terms_accepted: true,
      created_at: r["Created Date"] ?? startsAt,
    };
  });

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await admin.from("reservations").insert(rows.slice(i, i + 100));
    if (error) throw new Error(`reservations: ${error.message}`);
  }

  if (!DRY_RUN && rows.length) {
    await admin.from("restaurant_reservation_counters").upsert({
      restaurant_id: restaurantId,
      next_number: rows.length,
    });
  }

  return { reservations: rows.length };
}

async function main() {
  if (!BUBBLE_TOKEN) throw new Error("BUBBLE_API_TOKEN fehlt");

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(DRY_RUN ? "=== DRY-RUN ===" : "=== IMPORT ===");
  console.log(`Restaurant: ${RESTAURANT_SLUG}, Admin: ${ADMIN_EMAIL}`);

  const restaurantConstraint = [
    { key: "Restaurant", constraint_type: "equals", value: BUBBLE_RESTAURANT_ID },
  ];

  const bubbleTypes = [
    ["dishcategory", restaurantConstraint],
    ["beveragecategory", restaurantConstraint],
    ["dish", restaurantConstraint],
    ["beverage", restaurantConstraint],
    ["product", restaurantConstraint],
    ["productcategory", restaurantConstraint],
    ["productionpoint", restaurantConstraint],
    ["productstock", restaurantConstraint],
    ["orderstock", restaurantConstraint],
    ["employee", restaurantConstraint],
    ["employeetime", restaurantConstraint],
    ["employeetimetype", null],
    ["reservation", restaurantConstraint],
  ];

  const bubbleData = {};
  for (const [type, constraints] of bubbleTypes) {
    console.log(`Bubble laden: ${type}…`);
    bubbleData[type] = await bubbleFetchAll(type, constraints);
  }

  const {
    dishcategory: dishCategories,
    beveragecategory: beverageCategories,
    dish: dishes,
    beverage: beverages,
    product: products,
    productcategory: productCategories,
    productionpoint: productionPoints,
    productstock: productStocks,
    orderstock: orderStocks,
    employee: employees,
    employeetime: employeeTimes,
    employeetimetype: timeTypes,
    reservation: reservations,
  } = bubbleData;

  console.log("Bubble laden: orderstockitem…");
  const orderStockItems = await bubbleFetchAll("orderstockitem", restaurantConstraint);
  const orderStockItemsById = new Map(orderStockItems.map((row) => [row._id, row]));
  const productsById = new Map(products.map((p) => [p._id, p]));

  const menuPayload = buildMenuPayload({
    dishCategories,
    beverageCategories,
    dishes,
    beverages,
  });
  const inventoryPayload = buildInventoryPayload({
    products,
    productCategories,
    productionPoints,
    productStocks,
    orderStocks,
    orderStockItemsById,
    productsById,
  });

  console.log("Bubble gelesen:", {
    dishCategories: dishCategories.length,
    beverageCategories: beverageCategories.length,
    dishes: dishes.length,
    beverages: beverages.length,
    products: products.length,
    productStocks: productStocks.length,
    orderStocks: orderStocks.length,
    orderStockItems: orderStockItemsById.size,
    employees: employees.length,
    employeeTimes: employeeTimes.length,
    reservations: reservations.length,
  });
  console.log("Ziel-Import:", {
    menuCategories: menuPayload.categories.length,
    menuItems: menuPayload.items.length,
    ingredients: inventoryPayload.ingredients.length,
    purchaseOrders: inventoryPayload.orders.length,
    staffImport: employees.filter((e) => e.Email?.trim().toLowerCase() !== ADMIN_EMAIL).length,
    workEntries: employeeTimes.length,
    reservations: reservations.length,
  });

  if (DRY_RUN) {
    console.log("Dry-run fertig — keine DB-Änderungen.");
    return;
  }

  const { data: restaurant, error: rErr } = await admin
    .from("restaurants")
    .select("id, slug, name")
    .eq("slug", RESTAURANT_SLUG)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!restaurant?.id) throw new Error(`Restaurant ${RESTAURANT_SLUG} nicht in Supabase`);

  const adminCtx = await resolveAdminContext(admin, restaurant.id);
  console.log("Admin-Kontext:", {
    profileId: adminCtx.adminProfileId,
    employeeId: adminCtx.adminEmployeeId,
    staffId: adminCtx.adminStaffId,
    ownerPositionId: adminCtx.ownerPositionId,
  });

  const { data: statuses, error: stErr } = await admin.from("reservation_statuses").select("id, code");
  if (stErr) throw new Error(stErr.message);
  const statusByCode = new Map(statuses.map((s) => [s.code, s.id]));

  await clearModuleData(admin, restaurant.id, adminCtx);

  const menuStats = await importMenu(admin, restaurant.id, menuPayload);
  const invStats = await importInventory(admin, restaurant.id, inventoryPayload);
  const staffStats = await importStaff(admin, restaurant.id, {
    employees,
    timeTypes,
    employeeTimes,
  }, adminCtx);
  const resStats = await importReservations(admin, restaurant.id, reservations, statusByCode);
  await ensureAdminAccess(admin, restaurant.id, adminCtx);

  console.log("Import abgeschlossen:", {
    restaurant: restaurant.name,
    ...menuStats,
    ...invStats,
    ...staffStats,
    ...resStats,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
