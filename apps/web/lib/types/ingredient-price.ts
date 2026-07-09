export type IngredientPriceEntrySource =
  | "manual"
  | "delivery"
  | "import"
  | "invoice";

export type IngredientPriceEntry = {
  id: string;
  ingredientId: string;
  supplierId: string | null;
  unitPrice: number;
  unit: string;
  effectiveAt: string;
  source: IngredientPriceEntrySource;
  purchaseOrderId: string | null;
  purchaseOrderLineId: string | null;
};
