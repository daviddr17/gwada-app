import type { Ingredient } from "@/lib/types/inventory";
import type { PurchaseOrderLine } from "@/lib/types/purchase-order";

export const PURCHASE_ORDER_EXPORT_FILTER_ALL = "all";

export type PurchaseOrderLineDeliveryFilter =
  | typeof PURCHASE_ORDER_EXPORT_FILTER_ALL
  | "pending"
  | "delivered";

export type PurchaseOrderLineExportFilters = {
  categoryId: string;
  productionSiteId: string;
  brandId: string;
  deliveryStatus: PurchaseOrderLineDeliveryFilter;
};

export const DEFAULT_PURCHASE_ORDER_LINE_EXPORT_FILTERS: PurchaseOrderLineExportFilters =
  {
    categoryId: PURCHASE_ORDER_EXPORT_FILTER_ALL,
    productionSiteId: PURCHASE_ORDER_EXPORT_FILTER_ALL,
    brandId: PURCHASE_ORDER_EXPORT_FILTER_ALL,
    deliveryStatus: PURCHASE_ORDER_EXPORT_FILTER_ALL,
  };

export function countPurchaseOrderLineExportFilters(
  filters: PurchaseOrderLineExportFilters,
): number {
  let n = 0;
  if (filters.categoryId !== PURCHASE_ORDER_EXPORT_FILTER_ALL) n += 1;
  if (filters.productionSiteId !== PURCHASE_ORDER_EXPORT_FILTER_ALL) n += 1;
  if (filters.brandId !== PURCHASE_ORDER_EXPORT_FILTER_ALL) n += 1;
  if (filters.deliveryStatus !== PURCHASE_ORDER_EXPORT_FILTER_ALL) n += 1;
  return n;
}

function ingredientForLine(
  ingredients: Ingredient[],
  line: PurchaseOrderLine,
): Ingredient | undefined {
  return ingredients.find((i) => i.id === line.ingredientId);
}

export function filterPurchaseOrderLinesForExport(
  lines: PurchaseOrderLine[],
  ingredients: Ingredient[],
  filters: PurchaseOrderLineExportFilters,
): PurchaseOrderLine[] {
  return lines.filter((line) => {
    const ing = ingredientForLine(ingredients, line);
    if (filters.categoryId !== PURCHASE_ORDER_EXPORT_FILTER_ALL) {
      if (ing?.categoryId !== filters.categoryId) return false;
    }
    if (filters.productionSiteId !== PURCHASE_ORDER_EXPORT_FILTER_ALL) {
      if (ing?.productionSiteId !== filters.productionSiteId) return false;
    }
    if (filters.brandId !== PURCHASE_ORDER_EXPORT_FILTER_ALL) {
      if (ing?.brandId !== filters.brandId) return false;
    }
    if (filters.deliveryStatus === "pending" && line.deliveredAt) return false;
    if (filters.deliveryStatus === "delivered" && !line.deliveredAt) return false;
    return true;
  });
}
