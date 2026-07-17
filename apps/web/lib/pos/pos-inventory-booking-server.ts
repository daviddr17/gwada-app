import "server-only";

import { parseStockLogEntryFromJson } from "@/lib/supabase/inventory-db";
import type {
  IngredientStockLogFromPosOrder,
  IngredientStockLogFromPosVoid,
} from "@/lib/types/ingredient-stock-log";
import type { Ingredient } from "@/lib/types/inventory";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRestaurantPosSettings } from "@/lib/pos/pos-restaurant-settings-server";

async function loadIngredientsForServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<Ingredient[] | null> {
  const { data: ings, error: e1 } = await sb
    .from("inventory_ingredients")
    .select(
      "id,name,unit,current_stock,low_stock_threshold,supplier_id,category_id,production_site_id,brand_id,is_active,purchase_unit_price",
    )
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });
  if (e1) return null;

  const { data: logs, error: e2 } = await sb
    .from("inventory_stock_log_entries")
    .select("ingredient_id,seq,entry")
    .eq("restaurant_id", restaurantId)
    .order("ingredient_id", { ascending: true })
    .order("seq", { ascending: true });
  if (e2) return null;

  const byIng = new Map<string, Ingredient["stockLog"]>();
  for (const row of logs ?? []) {
    const ingId = row.ingredient_id as string;
    const ent = parseStockLogEntryFromJson(row.entry);
    if (!ent) continue;
    const arr = byIng.get(ingId) ?? [];
    arr.push(ent);
    byIng.set(ingId, arr);
  }

  return (ings ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    const id = o.id as string;
    return {
      id,
      name: o.name as string,
      unit: o.unit as string,
      currentStock: Number(o.current_stock),
      lowStockThreshold: Number(o.low_stock_threshold ?? 0),
      purchaseUnitPrice:
        o.purchase_unit_price == null ? null : Number(o.purchase_unit_price),
      supplierId: o.supplier_id as string,
      categoryId: o.category_id as string,
      productionSiteId: o.production_site_id as string,
      brandId: o.brand_id as string,
      active: (o.is_active as boolean) !== false,
      stockLog: byIng.get(id) ?? [],
    };
  });
}

async function loadStockActorProfile(
  sb: SupabaseClient,
  userId: string,
): Promise<{ userFirstName: string; userLastName: string }> {
  const { data: profile } = await sb
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", userId)
    .maybeSingle();

  return {
    userFirstName: (profile?.given_name as string | null) ?? "",
    userLastName: (profile?.family_name as string | null) ?? "",
  };
}

async function aggregatePosOrderRecipeQuantities(
  sb: SupabaseClient,
  restaurantId: string,
  orderId: string,
): Promise<{
  error: string | null;
  byIngredient: Map<string, { total: number; dishNames: Set<string> }>;
  orderNumber: number;
}> {
  const { data: order, error: orderErr } = await sb
    .from("pos_orders")
    .select("id, order_number")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (orderErr || !order) {
    return {
      error: orderErr?.message ?? "order_not_found",
      byIngredient: new Map(),
      orderNumber: 0,
    };
  }

  const { data: lines, error: linesErr } = await sb
    .from("pos_order_lines")
    .select("menu_item_id, name, quantity, ohne_ingredient_ids")
    .eq("order_id", orderId);
  if (linesErr) {
    return {
      error: linesErr.message,
      byIngredient: new Map(),
      orderNumber: Number(order.order_number ?? 0),
    };
  }

  const menuItemIds = [
    ...new Set(
      (lines ?? [])
        .map((l) => l.menu_item_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (menuItemIds.length === 0) {
    return {
      error: null,
      byIngredient: new Map(),
      orderNumber: Number(order.order_number ?? 0),
    };
  }

  const { data: recipeRows, error: recipeErr } = await sb
    .from("menu_item_recipe_lines")
    .select("menu_item_id, ingredient_id, amount")
    .eq("restaurant_id", restaurantId)
    .in("menu_item_id", menuItemIds);
  if (recipeErr) {
    return {
      error: recipeErr.message,
      byIngredient: new Map(),
      orderNumber: Number(order.order_number ?? 0),
    };
  }

  const recipesByItem = new Map<
    string,
    { ingredientId: string; amount: number }[]
  >();
  for (const row of recipeRows ?? []) {
    const r = row as Record<string, unknown>;
    const menuItemId = r.menu_item_id as string;
    const arr = recipesByItem.get(menuItemId) ?? [];
    arr.push({
      ingredientId: String(r.ingredient_id ?? ""),
      amount: Number(r.amount),
    });
    recipesByItem.set(menuItemId, arr);
  }

  const byIngredient = new Map<
    string,
    { total: number; dishNames: Set<string> }
  >();

  for (const line of lines ?? []) {
    const menuItemId = line.menu_item_id as string | null;
    if (!menuItemId) continue;
    const qty = Number(line.quantity ?? 0);
    if (qty <= 0) continue;
    const ohne = new Set(
      ((line.ohne_ingredient_ids as string[] | null) ?? []).filter(Boolean),
    );
    const recipes = recipesByItem.get(menuItemId) ?? [];
    const dishName = String(line.name ?? "Gericht").trim() || "Gericht";
    for (const recipe of recipes) {
      if (!recipe.ingredientId || ohne.has(recipe.ingredientId)) continue;
      const add = qty * recipe.amount;
      if (add <= 0) continue;
      const cur = byIngredient.get(recipe.ingredientId) ?? {
        total: 0,
        dishNames: new Set<string>(),
      };
      cur.total += add;
      cur.dishNames.add(dishName);
      byIngredient.set(recipe.ingredientId, cur);
    }
  }

  return {
    error: null,
    byIngredient,
    orderNumber: Number(order.order_number ?? 0),
  };
}

/** Deduct recipe stock when entering a KDS status that books inventory. */
export async function maybeDeductInventoryForPosOrder(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderId: string;
  kdsStatusId: string;
  userId: string;
}): Promise<{ error: string | null; deducted: boolean }> {
  const settings = await getRestaurantPosSettings(
    params.supabase,
    params.restaurantId,
  );
  if (!settings.inventoryBookingEnabled) {
    return { error: null, deducted: false };
  }

  const { data: status } = await params.supabase
    .from("pos_kds_statuses")
    .select("id, deduct_inventory_on_enter, is_active")
    .eq("id", params.kdsStatusId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (!status?.deduct_inventory_on_enter || status.is_active === false) {
    return { error: null, deducted: false };
  }

  const { data: order } = await params.supabase
    .from("pos_orders")
    .select("inventory_deducted_at")
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();
  if (order?.inventory_deducted_at) {
    return { error: null, deducted: false };
  }

  const { error: aggErr, byIngredient, orderNumber } =
    await aggregatePosOrderRecipeQuantities(
      params.supabase,
      params.restaurantId,
      params.orderId,
    );
  if (aggErr) return { error: aggErr, deducted: false };
  if (byIngredient.size === 0) {
    // Mark as handled so we don't retry forever on recipe-less dishes
    const at = new Date().toISOString();
    await params.supabase
      .from("pos_orders")
      .update({
        inventory_deducted_at: at,
        inventory_deducted_kds_status_id: params.kdsStatusId,
      })
      .eq("id", params.orderId)
      .eq("restaurant_id", params.restaurantId);
    return { error: null, deducted: false };
  }

  const ingredients = await loadIngredientsForServer(
    params.supabase,
    params.restaurantId,
  );
  if (!ingredients) {
    return { error: "Bestand konnte nicht geladen werden.", deducted: false };
  }

  const { userFirstName, userLastName } = await loadStockActorProfile(
    params.supabase,
    params.userId,
  );
  const at = new Date().toISOString();

  const updated = ingredients.map((ing) => {
    const deduct = byIngredient.get(ing.id);
    if (!deduct) return ing;

    const fromQuantity = ing.currentStock;
    const toQuantity = fromQuantity - deduct.total;
    const logEntry: IngredientStockLogFromPosOrder = {
      id: crypto.randomUUID(),
      at,
      userFirstName,
      userLastName,
      kind: "stock_from_pos_order",
      fromQuantity,
      toQuantity,
      unitId: ing.unit,
      unitLabel: ing.unit,
      orderId: params.orderId,
      orderNumber,
      dishName: [...deduct.dishNames].join(", "),
    };

    return {
      ...ing,
      currentStock: toQuantity,
      stockLog: [...(ing.stockLog ?? []), logEntry],
    };
  });

  const { error: saveErr } = await params.supabase.rpc(
    "inventory_replace_ingredients",
    {
      p_restaurant_id: params.restaurantId,
      p_ingredients: updated,
    },
  );
  if (saveErr) return { error: saveErr.message, deducted: false };

  const { error: markErr } = await params.supabase
    .from("pos_orders")
    .update({
      inventory_deducted_at: at,
      inventory_deducted_kds_status_id: params.kdsStatusId,
    })
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId);
  if (markErr) return { error: markErr.message, deducted: false };

  return { error: null, deducted: true };
}

/** Restore stock after void when reason says so and order was deducted. */
export async function maybeRestoreInventoryForPosVoid(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  orderId: string;
  paymentId: string;
  voidReasonId: string;
  userId: string;
}): Promise<{ error: string | null; restored: boolean }> {
  const { data: reason } = await params.supabase
    .from("pos_void_reasons")
    .select("id, restore_inventory, name")
    .eq("id", params.voidReasonId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (!reason?.restore_inventory) {
    return { error: null, restored: false };
  }

  const { data: order } = await params.supabase
    .from("pos_orders")
    .select("inventory_deducted_at, inventory_restored_at")
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (!order?.inventory_deducted_at || order.inventory_restored_at) {
    return { error: null, restored: false };
  }

  const { error: aggErr, byIngredient, orderNumber } =
    await aggregatePosOrderRecipeQuantities(
      params.supabase,
      params.restaurantId,
      params.orderId,
    );
  if (aggErr) return { error: aggErr, restored: false };
  if (byIngredient.size === 0) {
    const at = new Date().toISOString();
    await params.supabase
      .from("pos_orders")
      .update({ inventory_restored_at: at })
      .eq("id", params.orderId);
    return { error: null, restored: false };
  }

  const ingredients = await loadIngredientsForServer(
    params.supabase,
    params.restaurantId,
  );
  if (!ingredients) {
    return { error: "Bestand konnte nicht geladen werden.", restored: false };
  }

  const { userFirstName, userLastName } = await loadStockActorProfile(
    params.supabase,
    params.userId,
  );
  const at = new Date().toISOString();
  const reasonName = String(reason.name ?? "Storno");

  const updated = ingredients.map((ing) => {
    const addBack = byIngredient.get(ing.id);
    if (!addBack) return ing;

    const fromQuantity = ing.currentStock;
    const toQuantity = fromQuantity + addBack.total;
    const logEntry: IngredientStockLogFromPosVoid = {
      id: crypto.randomUUID(),
      at,
      userFirstName,
      userLastName,
      kind: "stock_from_pos_void",
      fromQuantity,
      toQuantity,
      unitId: ing.unit,
      unitLabel: ing.unit,
      orderId: params.orderId,
      orderNumber,
      paymentId: params.paymentId,
      voidReasonName: reasonName,
      dishName: [...addBack.dishNames].join(", "),
    };

    return {
      ...ing,
      currentStock: toQuantity,
      stockLog: [...(ing.stockLog ?? []), logEntry],
    };
  });

  const { error: saveErr } = await params.supabase.rpc(
    "inventory_replace_ingredients",
    {
      p_restaurant_id: params.restaurantId,
      p_ingredients: updated,
    },
  );
  if (saveErr) return { error: saveErr.message, restored: false };

  const { error: markErr } = await params.supabase
    .from("pos_orders")
    .update({ inventory_restored_at: at })
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId);
  if (markErr) return { error: markErr.message, restored: false };

  return { error: null, restored: true };
}
