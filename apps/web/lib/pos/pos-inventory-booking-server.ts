import "server-only";

import { after } from "next/server";
import { applyIngredientStockDeltas } from "@/lib/inventory/apply-ingredient-stock-deltas";
import type {
  IngredientStockLogFromPosOrder,
  IngredientStockLogFromPosVoid,
} from "@/lib/types/ingredient-stock-log";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRestaurantPosSettings } from "@/lib/pos/pos-restaurant-settings-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function loadIngredientStockSnapshot(
  sb: SupabaseClient,
  restaurantId: string,
  ingredientIds: string[],
): Promise<Map<string, { unit: string; currentStock: number }> | null> {
  if (ingredientIds.length === 0) return new Map();
  const { data, error } = await sb
    .from("inventory_ingredients")
    .select("id,unit,current_stock")
    .eq("restaurant_id", restaurantId)
    .in("id", ingredientIds);
  if (error) return null;
  const map = new Map<string, { unit: string; currentStock: number }>();
  for (const row of data ?? []) {
    const o = row as { id: string; unit: string; current_stock: number };
    map.set(o.id, { unit: o.unit, currentStock: Number(o.current_stock) });
  }
  return map;
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

  const snapshot = await loadIngredientStockSnapshot(
    params.supabase,
    params.restaurantId,
    [...byIngredient.keys()],
  );
  if (!snapshot) {
    return { error: "Bestand konnte nicht geladen werden.", deducted: false };
  }

  const { userFirstName, userLastName } = await loadStockActorProfile(
    params.supabase,
    params.userId,
  );
  const at = new Date().toISOString();

  const items = [...byIngredient.entries()].flatMap(([ingredientId, deduct]) => {
    const ing = snapshot.get(ingredientId);
    if (!ing) return [];
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
    return [
      {
        ingredientId,
        delta: -deduct.total,
        stockLog: logEntry,
      },
    ];
  });

  const saved = await applyIngredientStockDeltas(
    params.supabase,
    params.restaurantId,
    items,
  );
  if (!saved.ok) return { error: saved.message, deducted: false };

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

  const snapshot = await loadIngredientStockSnapshot(
    params.supabase,
    params.restaurantId,
    [...byIngredient.keys()],
  );
  if (!snapshot) {
    return { error: "Bestand konnte nicht geladen werden.", restored: false };
  }

  const { userFirstName, userLastName } = await loadStockActorProfile(
    params.supabase,
    params.userId,
  );
  const at = new Date().toISOString();
  const reasonName = String(reason.name ?? "Storno");

  const items = [...byIngredient.entries()].flatMap(([ingredientId, addBack]) => {
    const ing = snapshot.get(ingredientId);
    if (!ing) return [];
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
    return [
      {
        ingredientId,
        delta: addBack.total,
        stockLog: logEntry,
      },
    ];
  });

  const saved = await applyIngredientStockDeltas(
    params.supabase,
    params.restaurantId,
    items,
  );
  if (!saved.ok) return { error: saved.message, restored: false };

  const { error: markErr } = await params.supabase
    .from("pos_orders")
    .update({ inventory_restored_at: at })
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId);
  if (markErr) return { error: markErr.message, restored: false };

  return { error: null, restored: true };
}

type PosInventoryDeductJob = {
  restaurantId: string;
  orderId: string;
  kdsStatusId: string;
  userId: string;
};

type PosInventoryRestoreJob = {
  restaurantId: string;
  orderId: string;
  paymentId: string;
  voidReasonId: string;
  userId: string;
};

/**
 * Bestandsabzug nach HTTP-Antwort — Kasse/KDS warten nicht auf Lagerlogik.
 * Nutzt Service-Role, damit der Request-Client schon weg sein darf.
 */
export function schedulePosInventoryDeduct(job: PosInventoryDeductJob): void {
  const run = () => {
    void (async () => {
      const admin = createSupabaseAdminClient();
      if (!admin) {
        console.warn("[pos] inventory deduct skipped: no admin client");
        return;
      }
      const result = await maybeDeductInventoryForPosOrder({
        supabase: admin,
        restaurantId: job.restaurantId,
        orderId: job.orderId,
        kdsStatusId: job.kdsStatusId,
        userId: job.userId,
      });
      if (result.error) {
        console.warn("[pos] inventory deduct", result.error);
      }
    })().catch((err) => {
      console.warn(
        "[pos] inventory deduct",
        err instanceof Error ? err.message : err,
      );
    });
  };

  try {
    after(run);
  } catch {
    run();
  }
}

/** Bestandsrückbuchung nach Storno — ebenfalls hinter der Antwort. */
export function schedulePosInventoryRestore(job: PosInventoryRestoreJob): void {
  const run = () => {
    void (async () => {
      const admin = createSupabaseAdminClient();
      if (!admin) {
        console.warn("[pos] inventory restore skipped: no admin client");
        return;
      }
      const result = await maybeRestoreInventoryForPosVoid({
        supabase: admin,
        restaurantId: job.restaurantId,
        orderId: job.orderId,
        paymentId: job.paymentId,
        voidReasonId: job.voidReasonId,
        userId: job.userId,
      });
      if (result.error) {
        console.warn("[pos] inventory restore", result.error);
      }
    })().catch((err) => {
      console.warn(
        "[pos] inventory restore",
        err instanceof Error ? err.message : err,
      );
    });
  };

  try {
    after(run);
  } catch {
    run();
  }
}
