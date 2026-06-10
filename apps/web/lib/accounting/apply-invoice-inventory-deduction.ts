import "server-only";

import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import { parseStockLogEntryFromJson } from "@/lib/supabase/inventory-db";
import type { AccountingLineItem } from "@/lib/types/accounting";
import type {
  IngredientStockLogFromInvoice,
  IngredientStockLogFromInvoiceCorrection,
} from "@/lib/types/ingredient-stock-log";
import type { Ingredient } from "@/lib/types/inventory";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadIngredientsForServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<Ingredient[] | null> {
  const { data: ings, error: e1 } = await sb
    .from("inventory_ingredients")
    .select(
      "id,name,unit,current_stock,supplier_id,category_id,production_site_id,brand_id,is_active",
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
      supplierId: o.supplier_id as string,
      categoryId: o.category_id as string,
      productionSiteId: o.production_site_id as string,
      brandId: o.brand_id as string,
      active: (o.is_active as boolean) !== false,
      stockLog: byIng.get(id) ?? [],
    };
  });
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

  const ingredients = await loadIngredientsForServer(sb, params.restaurantId);
  if (!ingredients) {
    return { error: "Bestand konnte nicht geladen werden." };
  }

  const { userFirstName, userLastName } = await loadStockActorProfile(
    sb,
    params.userId,
  );
  const at = new Date().toISOString();

  const updated = ingredients.map((ing) => {
    const deduct = byIngredient.get(ing.id);
    if (!deduct) return ing;

    const fromQuantity = ing.currentStock;
    const toQuantity = fromQuantity - deduct.total;
    const articleName = [...deduct.articleNames].join(", ");
    const logEntry: IngredientStockLogFromInvoice = {
      id: crypto.randomUUID(),
      at,
      userFirstName,
      userLastName,
      userSource: "local_profile",
      kind: "stock_from_invoice",
      fromQuantity,
      toQuantity,
      unitId: ing.unit,
      unitLabel: ing.unit,
      invoiceId: params.invoiceId,
      voucherNumber: params.voucherNumber,
      articleName,
    };

    return {
      ...ing,
      currentStock: toQuantity,
      stockLog: [...(ing.stockLog ?? []), logEntry],
    };
  });

  const { error: saveErr } = await sb.rpc("inventory_replace_ingredients", {
    p_restaurant_id: params.restaurantId,
    p_ingredients: updated,
  });
  if (saveErr) return { error: saveErr.message };

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

  const ingredients = await loadIngredientsForServer(sb, params.restaurantId);
  if (!ingredients) {
    return { error: "Bestand konnte nicht geladen werden." };
  }

  const { userFirstName, userLastName } = await loadStockActorProfile(
    sb,
    params.userId,
  );
  const at = new Date().toISOString();

  const updated = ingredients.map((ing) => {
    const addBack = byIngredient.get(ing.id);
    if (!addBack) return ing;

    const fromQuantity = ing.currentStock;
    const toQuantity = fromQuantity + addBack.total;
    const articleName = [...addBack.articleNames].join(", ");
    const logEntry: IngredientStockLogFromInvoiceCorrection = {
      id: crypto.randomUUID(),
      at,
      userFirstName,
      userLastName,
      userSource: "local_profile",
      kind: "stock_from_invoice_correction",
      fromQuantity,
      toQuantity,
      unitId: ing.unit,
      unitLabel: ing.unit,
      invoiceId: params.correctionInvoiceId,
      correctsInvoiceId: params.correctsInvoiceId,
      voucherNumber: params.correctionVoucherNumber,
      originalVoucherNumber: params.originalVoucherNumber,
      articleName,
    };

    return {
      ...ing,
      currentStock: toQuantity,
      stockLog: [...(ing.stockLog ?? []), logEntry],
    };
  });

  const { error: saveErr } = await sb.rpc("inventory_replace_ingredients", {
    p_restaurant_id: params.restaurantId,
    p_ingredients: updated,
  });
  if (saveErr) return { error: saveErr.message };

  const { error: markErr } = await sb
    .from("accounting_invoices")
    .update({ inventory_reversed_at: at })
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.correctionInvoiceId);
  if (markErr) return { error: markErr.message };

  return { error: null };
}
