import type { AddPurchaseLineParams } from "@/lib/hooks/use-purchase-orders-storage";
import { matchIngredientFromVoiceQuery } from "@/lib/inventory/match-ingredient-voice-query";
import type { ParsedPurchaseOrderVoice } from "@/lib/inventory/parse-purchase-order-voice-text";
import type { Ingredient } from "@/lib/types/inventory";
import type { OrderProtocolActor } from "@/lib/types/purchase-order";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";

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

export type ResolvePurchaseOrderVoiceResult =
  | { ok: true; lines: PurchaseOrderVoiceResolvedLine[] }
  | { ok: false; error: string };

type OpenLineContext = {
  orderId: string | null;
  lineId: string | null;
  quantity: number;
};

export function resolvePurchaseOrderVoiceLines(params: {
  parsed: ParsedPurchaseOrderVoice;
  ingredients: Ingredient[];
  suppliers: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
  getOpenLineContext: (supplierId: string, ingredientId: string) => OpenLineContext;
}): ResolvePurchaseOrderVoiceResult {
  const lines: PurchaseOrderVoiceResolvedLine[] = [];

  for (const item of params.parsed.items) {
    const match = matchIngredientFromVoiceQuery(item.articleQuery, params.ingredients);
    if (!match.ok) return match;

    const ingredient = match.ingredient;
    if (!ingredient.supplierId?.trim()) {
      return {
        ok: false,
        error: `„${ingredient.name}" hat keinen Lieferanten und kann nicht bestellt werden.`,
      };
    }

    const supplier = params.suppliers.find((s) => s.id === ingredient.supplierId);
    const brand = params.brands.find((b) => b.id === ingredient.brandId);
    const unit = params.units.find((u) => u.id === ingredient.unit);
    const unitLabel = unit?.name ?? ingredient.unit;
    const openCtx = params.getOpenLineContext(
      ingredient.supplierId,
      ingredient.id,
    );

    lines.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantity: item.quantity,
      unitLabel,
      previousQuantity: openCtx.lineId ? openCtx.quantity : null,
      supplierId: ingredient.supplierId,
      supplierName: supplier?.name ?? ingredient.supplierId,
      brandLabel: brand?.name ?? "",
      unitId: ingredient.unit,
    });
  }

  return { ok: true, lines };
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
