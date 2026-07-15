import type { AddPurchaseLineParams } from "@/lib/hooks/use-purchase-orders-storage";
import type { UpdateIngredientOptions } from "@/lib/hooks/use-ingredients-storage";
import {
  resolveIngredientVoiceMatchWithQueries,
  type IngredientVoiceMatchCandidate,
} from "@/lib/inventory/match-ingredient-voice-query";
import { resolveInventoryUnitDisplayLabel } from "@/lib/inventory/inventory-unit-label-de";
import {
  parsePurchaseOrderVoiceText,
  type ParsedPurchaseOrderVoice,
} from "@/lib/inventory/parse-purchase-order-voice-text";
import type { Ingredient } from "@/lib/types/inventory";
import type { OrderProtocolActor } from "@/lib/types/purchase-order";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";

export type InventoryVoiceMode = "stock" | "order";

export type PurchaseOrderVoiceResolvedLine = {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unitLabel: string;
  previousQuantity: number | null;
  supplierId: string;
  supplierName: string;
  brandLabel: string;
  unitId: string;
};

export type PurchaseOrderVoiceAmbiguity = {
  itemIndex: number;
  heardQuery: string;
  quantity: number;
  candidates: IngredientVoiceMatchCandidate[];
};

export type ResolvePurchaseOrderVoiceResult =
  | { ok: true; lines: PurchaseOrderVoiceResolvedLine[] }
  | { ok: false; error: string }
  | { ok: false; ambiguity: PurchaseOrderVoiceAmbiguity };

type OpenLineContext = {
  orderId: string | null;
  lineId: string | null;
  quantity: number;
};

export type PurchaseOrderVoiceItemInput = {
  quantity: number;
  articleQueries: string[];
};

function buildOrderResolvedLine(params: {
  ingredient: Ingredient;
  quantity: number;
  suppliers: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
  getOpenLineContext: (supplierId: string, ingredientId: string) => OpenLineContext;
}): PurchaseOrderVoiceResolvedLine | { error: string } {
  if (!params.ingredient.supplierId?.trim()) {
    return {
      error: `„${params.ingredient.name}" hat keinen Lieferanten und kann nicht bestellt werden.`,
    };
  }

  const supplier = params.suppliers.find((s) => s.id === params.ingredient.supplierId);
  const brand = params.brands.find((b) => b.id === params.ingredient.brandId);
  const unit = params.units.find((u) => u.id === params.ingredient.unit);
  const unitLabel = resolveInventoryUnitDisplayLabel(
    params.ingredient.unit,
    params.units,
    unit?.name,
  );
  const openCtx = params.getOpenLineContext(
    params.ingredient.supplierId,
    params.ingredient.id,
  );

  return {
    ingredientId: params.ingredient.id,
    ingredientName: params.ingredient.name,
    quantity: params.quantity,
    unitLabel,
    previousQuantity: openCtx.lineId ? openCtx.quantity : null,
    supplierId: params.ingredient.supplierId,
    supplierName: supplier?.name ?? params.ingredient.supplierId,
    brandLabel: brand?.name ?? "",
    unitId: params.ingredient.unit,
  };
}

function buildStockResolvedLine(params: {
  ingredient: Ingredient;
  quantity: number;
  units: InventoryTaxonomyDefinition[];
}): PurchaseOrderVoiceResolvedLine {
  const unit = params.units.find((u) => u.id === params.ingredient.unit);
  const unitLabel = resolveInventoryUnitDisplayLabel(
    params.ingredient.unit,
    params.units,
    unit?.name,
  );

  return {
    ingredientId: params.ingredient.id,
    ingredientName: params.ingredient.name,
    quantity: params.quantity,
    unitLabel,
    previousQuantity: params.ingredient.currentStock,
    supplierId: params.ingredient.supplierId,
    supplierName: "",
    brandLabel: "",
    unitId: params.ingredient.unit,
  };
}

function resolveVoiceItemMatch(params: {
  item: PurchaseOrderVoiceItemInput;
  itemIndex: number;
  mode: InventoryVoiceMode;
  ingredients: Ingredient[];
  suppliers: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
  getOpenLineContext: (supplierId: string, ingredientId: string) => OpenLineContext;
}): ResolvePurchaseOrderVoiceResult {
  const match = resolveIngredientVoiceMatchWithQueries(
    params.item.articleQueries,
    params.ingredients,
  );

  if (match.status === "ambiguous") {
    return {
      ok: false,
      ambiguity: {
        itemIndex: params.itemIndex,
        heardQuery: params.item.articleQueries[0] ?? match.query,
        quantity: params.item.quantity,
        candidates: match.candidates,
      },
    };
  }

  if (match.status === "unmatched") {
    const hint =
      match.suggestions.length > 0
        ? ` Meintest du „${match.suggestions[0]!.ingredient.name}"?`
        : "";
    return {
      ok: false,
      error: `Keine Zutat für „${match.query}" gefunden.${hint}`,
    };
  }

  const line =
    params.mode === "stock"
      ? buildStockResolvedLine({
          ingredient: match.ingredient,
          quantity: params.item.quantity,
          units: params.units,
        })
      : buildOrderResolvedLine({
          ingredient: match.ingredient,
          quantity: params.item.quantity,
          suppliers: params.suppliers,
          brands: params.brands,
          units: params.units,
          getOpenLineContext: params.getOpenLineContext,
        });

  if ("error" in line) {
    return { ok: false, error: line.error };
  }

  return { ok: true, lines: [line] };
}

export function resolveInventoryVoiceLines(params: {
  mode: InventoryVoiceMode;
  items: PurchaseOrderVoiceItemInput[];
  ingredients: Ingredient[];
  suppliers: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
  getOpenLineContext: (supplierId: string, ingredientId: string) => OpenLineContext;
}): ResolvePurchaseOrderVoiceResult {
  const lines: PurchaseOrderVoiceResolvedLine[] = [];

  for (let itemIndex = 0; itemIndex < params.items.length; itemIndex++) {
    const item = params.items[itemIndex]!;
    const result = resolveVoiceItemMatch({
      item,
      itemIndex,
      mode: params.mode,
      ingredients: params.ingredients,
      suppliers: params.suppliers,
      brands: params.brands,
      units: params.units,
      getOpenLineContext: params.getOpenLineContext,
    });

    if (!result.ok) return result;
    lines.push(...result.lines);
  }

  return { ok: true, lines };
}

export function resolvePurchaseOrderVoiceLines(params: {
  items: PurchaseOrderVoiceItemInput[];
  ingredients: Ingredient[];
  suppliers: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
  getOpenLineContext: (supplierId: string, ingredientId: string) => OpenLineContext;
}): ResolvePurchaseOrderVoiceResult {
  return resolveInventoryVoiceLines({ ...params, mode: "order" });
}

/** Parsed items + STT-Alternativen pro Position zusammenführen. */
export function buildPurchaseOrderVoiceItems(
  parsed: ParsedPurchaseOrderVoice,
  transcriptAlternatives: string[],
): PurchaseOrderVoiceItemInput[] {
  const parsedVariants: ParsedPurchaseOrderVoice[] = [];
  for (const alt of transcriptAlternatives) {
    const result = parsePurchaseOrderVoiceText(alt);
    if (result.ok && result.parsed.items.length === parsed.items.length) {
      parsedVariants.push(result.parsed);
    }
  }

  return parsed.items.map((item, index) => {
    const queries = new Set<string>([item.articleQuery]);
    for (const variant of parsedVariants) {
      const altItem = variant.items[index];
      if (altItem?.articleQuery.trim()) {
        queries.add(altItem.articleQuery.trim());
      }
    }
    return {
      quantity: item.quantity,
      articleQueries: [...queries],
    };
  });
}

export function resolveInventoryVoiceLineForIngredient(params: {
  mode: InventoryVoiceMode;
  ingredientId: string;
  quantity: number;
  ingredients: Ingredient[];
  suppliers: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
  getOpenLineContext: (supplierId: string, ingredientId: string) => OpenLineContext;
}): ResolvePurchaseOrderVoiceResult {
  const ingredient = params.ingredients.find((i) => i.id === params.ingredientId);
  if (!ingredient) {
    return { ok: false, error: "Zutat nicht gefunden." };
  }

  const line =
    params.mode === "stock"
      ? buildStockResolvedLine({
          ingredient,
          quantity: params.quantity,
          units: params.units,
        })
      : buildOrderResolvedLine({
          ingredient,
          quantity: params.quantity,
          suppliers: params.suppliers,
          brands: params.brands,
          units: params.units,
          getOpenLineContext: params.getOpenLineContext,
        });

  if ("error" in line) {
    return { ok: false, error: line.error };
  }
  return { ok: true, lines: [line] };
}

export function resolvePurchaseOrderVoiceLineForIngredient(params: {
  ingredientId: string;
  quantity: number;
  ingredients: Ingredient[];
  suppliers: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
  getOpenLineContext: (supplierId: string, ingredientId: string) => OpenLineContext;
}): ResolvePurchaseOrderVoiceResult {
  return resolveInventoryVoiceLineForIngredient({ ...params, mode: "order" });
}

export async function applyPurchaseOrderVoiceLines(params: {
  lines: PurchaseOrderVoiceResolvedLine[];
  actor: OrderProtocolActor;
  getOpenLineContext: (supplierId: string, ingredientId: string) => OpenLineContext;
  addLine: (p: AddPurchaseLineParams) => Promise<boolean>;
  updateLineQuantity: (
    orderId: string,
    lineId: string,
    qty: number,
    user: OrderProtocolActor,
  ) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const line of params.lines) {
    const openCtx = params.getOpenLineContext(line.supplierId, line.ingredientId);

    if (openCtx.lineId && openCtx.orderId) {
      const ok = await params.updateLineQuantity(
        openCtx.orderId,
        openCtx.lineId,
        line.quantity,
        params.actor,
      );
      if (!ok) {
        return {
          ok: false,
          error: `Menge für „${line.ingredientName}" konnte nicht gespeichert werden.`,
        };
      }
      continue;
    }

    const ok = await params.addLine({
      supplierId: line.supplierId,
      supplierName: line.supplierName,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      brandLabel: line.brandLabel,
      quantity: line.quantity,
      unitId: line.unitId,
      unitLabel: line.unitLabel,
      actor: params.actor,
    });
    if (!ok) {
      return {
        ok: false,
        error: `„${line.ingredientName}" konnte nicht zur Bestellung hinzugefügt werden.`,
      };
    }
  }

  return { ok: true };
}

export async function applyInventoryStockVoiceLines(params: {
  lines: PurchaseOrderVoiceResolvedLine[];
  actor: OrderProtocolActor;
  updateIngredient: (
    id: string,
    patch: Partial<Ingredient>,
    opts?: UpdateIngredientOptions,
  ) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const line of params.lines) {
    const ok = await params.updateIngredient(
      line.ingredientId,
      { currentStock: line.quantity },
      {
        stockActor: params.actor,
        stockUnitLabel: line.unitLabel,
      },
    );
    if (!ok) {
      return {
        ok: false,
        error: `Bestand für „${line.ingredientName}" konnte nicht gespeichert werden.`,
      };
    }
  }

  return { ok: true };
}
