import { startOfLocalDay } from "@/lib/reservations/month-range";
import type { InventoryStatsPeriod } from "@/lib/inventory/compute-inventory-statistics";
import {
  loadIngredientsRelational,
  loadInventoryTaxonomyRelational,
  loadPurchaseOrdersRelational,
} from "@/lib/supabase/inventory-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { Ingredient } from "@/lib/types/inventory";
import type { PurchaseOrder } from "@/lib/types/purchase-order";

export type InventoryStatisticsBundle = {
  ingredients: Ingredient[];
  orders: PurchaseOrder[];
  categoryNames: Map<string, string>;
  supplierNames: Map<string, string>;
  periodStart: Date;
  periodEnd: Date;
};

function periodRange(monthsBack: InventoryStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = startOfLocalDay(new Date());
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return { periodStart, periodEnd };
}

function namesMap(
  rows: { id: string; name: string }[] | null | undefined,
): Map<string, string> {
  return new Map((rows ?? []).map((row) => [row.id, row.name]));
}

export async function fetchInventoryStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: InventoryStatsPeriod;
}): Promise<{ data: InventoryStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd } = periodRange(months);

  const [ingredients, orders, categories, suppliers] = await Promise.all([
    loadIngredientsRelational(params.restaurantId),
    loadPurchaseOrdersRelational(params.restaurantId),
    loadInventoryTaxonomyRelational(
      "inventory_ingredient_categories",
      params.restaurantId,
    ),
    loadInventoryTaxonomyRelational("inventory_suppliers", params.restaurantId),
  ]);

  if (ingredients == null || orders == null) {
    return {
      data: null,
      error: "Bestandsdaten konnten nicht geladen werden.",
    };
  }

  return {
    data: {
      ingredients,
      orders,
      categoryNames: namesMap(categories ?? []),
      supplierNames: namesMap(suppliers ?? []),
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
