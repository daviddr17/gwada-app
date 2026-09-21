import "server-only";

import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import { applyIngredientStockDeltas } from "@/lib/inventory/apply-ingredient-stock-deltas";
import type { AccountingLineItem } from "@/lib/types/accounting";
import type {
  IngredientStockLogFromInvoice,
  IngredientStockLogFromInvoiceCorrection,
} from "@/lib/types/ingredient-stock-log";
import type { SupabaseClient } from "@supabase/supabase-js";

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

async function aggregateRecipeQuantitiesByIngredient(
  sb: SupabaseClient,
  restaurantId: string,
  lineItems: AccountingLineItem[],
): Promise<
  | { error: string | null; byIngredient: Map<string, { total: number; articleNames: Set<string> }> }
> {
  const articleLines = lineItems.filter(
    (l) => l.type === "article" && l.articleId && l.quantity > 0,
  );
  if (articleLines.length === 0) {
    return { error: null, byIngredient: new Map() };
  }

  const articleIds = [...new Set(articleLines.map((l) => l.articleId!))];
  const { data: recipeRows, error: recipeErr } = await sb
    .from("accounting_article_recipe_lines")
    .select("article_id, ingredient_id, amount")
    .eq("restaurant_id", restaurantId)
    .in("article_id", articleIds);
  if (recipeErr) return { error: recipeErr.message, byIngredient: new Map() };
  if (!recipeRows?.length) {
    return { error: null, byIngredient: new Map() };
  }

  const recipesByArticle = new Map<
    string,
    { ingredientId: string; amount: number }[]
  >();
  for (const row of recipeRows) {
    const r = row as Record<string, unknown>;
    const articleId = r.article_id as string;
    const arr = recipesByArticle.get(articleId) ?? [];
    arr.push({
      ingredientId: r.ingredient_id as string,
      amount: Number(r.amount),
    });
    recipesByArticle.set(articleId, arr);
  }

  const byIngredient = new Map<
    string,
    { total: number; articleNames: Set<string> }
  >();

  for (const line of articleLines) {
    const recipes = recipesByArticle.get(line.articleId!) ?? [];
    if (!recipes.length) continue;
    for (const recipeLine of recipes) {
      const qty = line.quantity * recipeLine.amount;
      if (qty <= 0) continue;
      const cur = byIngredient.get(recipeLine.ingredientId) ?? {
        total: 0,
        articleNames: new Set<string>(),
      };
      cur.total += qty;
      cur.articleNames.add(line.name.trim() || "Artikel");
      byIngredient.set(recipeLine.ingredientId, cur);
    }
  }

  return { error: null, byIngredient };
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

export async function applyInvoiceInventoryDeduction(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    invoiceId: string;
    voucherNumber: string | null;
    lineItems: AccountingLineItem[];
  },
): Promise<{ error: string | null }> {
  const settings = await getAccountingSettings(sb, params.restaurantId);
  if (!settings.deduct_inventory_on_invoice) {
    return { error: null };
  }

  const { data: invoiceRow } = await sb
    .from("accounting_invoices")
    .select("inventory_deducted_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.invoiceId)
    .maybeSingle();
  if (invoiceRow?.inventory_deducted_at) {
    return { error: null };
  }

  const { error: aggErr, byIngredient } = await aggregateRecipeQuantitiesByIngredient(
    sb,
    params.restaurantId,
    params.lineItems,
  );
  if (aggErr) return { error: aggErr };
  if (byIngredient.size === 0) {
    return { error: null };
  }

  const snapshot = await loadIngredientStockSnapshot(
    sb,
    params.restaurantId,
    [...byIngredient.keys()],
  );
  if (!snapshot) {
    return { error: "Bestand konnte nicht geladen werden." };
  }

  const { userFirstName, userLastName } = await loadStockActorProfile(
    sb,
    params.userId,
  );
  const at = new Date().toISOString();

  const items = [...byIngredient.entries()].flatMap(([ingredientId, deduct]) => {
    const ing = snapshot.get(ingredientId);
    if (!ing) return [];
    const fromQuantity = ing.currentStock;
    const toQuantity = fromQuantity - deduct.total;
    const logEntry: IngredientStockLogFromInvoice = {
      id: crypto.randomUUID(),
      at,
      userFirstName,
      userLastName,
      kind: "stock_from_invoice",
      fromQuantity,
      toQuantity,
      unitId: ing.unit,
      unitLabel: ing.unit,
      invoiceId: params.invoiceId,
      voucherNumber: params.voucherNumber,
      articleName: [...deduct.articleNames].join(", "),
    };
    return [{ ingredientId, delta: -deduct.total, stockLog: logEntry }];
  });

  const saved = await applyIngredientStockDeltas(sb, params.restaurantId, items);
  if (!saved.ok) return { error: saved.message };

  const { error: markErr } = await sb
    .from("accounting_invoices")
    .update({ inventory_deducted_at: at })
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.invoiceId);
  if (markErr) return { error: markErr.message };

  return { error: null };
}

export async function applyInvoiceInventoryCorrectionReversal(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    correctionInvoiceId: string;
    correctionVoucherNumber: string | null;
    correctsInvoiceId: string;
    originalVoucherNumber: string | null;
    lineItems: AccountingLineItem[];
  },
): Promise<{ error: string | null }> {
  const settings = await getAccountingSettings(sb, params.restaurantId);
  if (!settings.reverse_inventory_on_invoice_correction) {
    return { error: null };
  }

  const { data: correctionRow } = await sb
    .from("accounting_invoices")
    .select("inventory_reversed_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.correctionInvoiceId)
    .maybeSingle();
  if (correctionRow?.inventory_reversed_at) {
    return { error: null };
  }

  const { data: originalRow } = await sb
    .from("accounting_invoices")
    .select("inventory_deducted_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.correctsInvoiceId)
    .maybeSingle();
  if (!originalRow?.inventory_deducted_at) {
    return { error: null };
  }

  const { error: aggErr, byIngredient } = await aggregateRecipeQuantitiesByIngredient(
    sb,
    params.restaurantId,
    params.lineItems,
  );
  if (aggErr) return { error: aggErr };
  if (byIngredient.size === 0) {
    return { error: null };
  }

  const snapshot = await loadIngredientStockSnapshot(
    sb,
    params.restaurantId,
    [...byIngredient.keys()],
  );
  if (!snapshot) {
    return { error: "Bestand konnte nicht geladen werden." };
  }

  const { userFirstName, userLastName } = await loadStockActorProfile(
    sb,
    params.userId,
  );
  const at = new Date().toISOString();

  const items = [...byIngredient.entries()].flatMap(([ingredientId, addBack]) => {
    const ing = snapshot.get(ingredientId);
    if (!ing) return [];
    const fromQuantity = ing.currentStock;
    const toQuantity = fromQuantity + addBack.total;
    const logEntry: IngredientStockLogFromInvoiceCorrection = {
      id: crypto.randomUUID(),
      at,
      userFirstName,
      userLastName,
      kind: "stock_from_invoice_correction",
      fromQuantity,
      toQuantity,
      unitId: ing.unit,
      unitLabel: ing.unit,
      invoiceId: params.correctionInvoiceId,
      correctsInvoiceId: params.correctsInvoiceId,
      voucherNumber: params.correctionVoucherNumber,
      originalVoucherNumber: params.originalVoucherNumber,
      articleName: [...addBack.articleNames].join(", "),
    };
    return [{ ingredientId, delta: addBack.total, stockLog: logEntry }];
  });

  const saved = await applyIngredientStockDeltas(sb, params.restaurantId, items);
  if (!saved.ok) return { error: saved.message };

  const { error: markErr } = await sb
    .from("accounting_invoices")
    .update({ inventory_reversed_at: at })
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.correctionInvoiceId);
  if (markErr) return { error: markErr.message };

  return { error: null };
}
