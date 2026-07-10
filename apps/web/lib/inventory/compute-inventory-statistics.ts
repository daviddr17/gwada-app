import type { Ingredient } from "@/lib/types/inventory";
import type { IngredientStockLogEntry } from "@/lib/types/ingredient-stock-log";
import type { PurchaseOrder, PurchaseOrderLine } from "@/lib/types/purchase-order";
import { roundPurchaseUnitPrice } from "@/lib/inventory/format-purchase-unit-price";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type InventoryStatsPeriod = 3 | 6 | 12;

const MOVEMENT_LABELS: Record<string, string> = {
  manual_stock: "Manuell",
  stock_from_delivery: "Lieferung",
  stock_from_invoice: "Rechnung",
  stock_from_invoice_correction: "Korrektur",
  stock_delivery_reverted: "Lieferung zurück",
};

const MOVEMENT_COLORS: Record<string, string> = {
  manual_stock: "var(--chart-1)",
  stock_from_delivery: "var(--chart-2)",
  stock_from_invoice: "var(--chart-3)",
  stock_from_invoice_correction: "var(--chart-4)",
  stock_delivery_reverted: "var(--chart-5)",
};

export type InventoryStatisticsInput = {
  ingredients: Ingredient[];
  orders: PurchaseOrder[];
  categoryNames: Map<string, string>;
  supplierNames: Map<string, string>;
  periodStart: Date;
  periodEnd: Date;
};

export type InventoryStatisticsResult = {
  activeIngredients: number;
  emptyStockCount: number;
  lowStockCount: number;
  openOrders: number;
  openOrderLines: number;
  ordersInPeriod: number;
  closedOrdersInPeriod: number;
  orderLinesInPeriod: number;
  stockMovementsInPeriod: number;
  deliveriesInPeriod: number;
  invoiceMovementsInPeriod: number;
  topCategory: string | null;
  topOrderSupplier: string | null;
  pricedIngredientsCount: number;
  unpricedIngredientsCount: number;
  totalStockValue: number;
  avgPurchasePrice: number | null;
  openOrdersValue: number;
  ordersValueInPeriod: number;
  deliveredValueInPeriod: number;
  unpricedOrderLinesInPeriod: number;
  byCategory: Array<{ name: string; count: number }>;
  bySupplier: Array<{ name: string; count: number }>;
  byOrderSupplier: Array<{ name: string; count: number }>;
  stockValueByCategory: Array<{ name: string; value: number }>;
  orderValueBySupplier: Array<{ name: string; value: number }>;
  byMovementKind: Array<{ kind: string; label: string; count: number; fill: string }>;
  ordersByMonth: Array<{ month: string; count: number }>;
  orderValueByMonth: Array<{ month: string; value: number }>;
  ordersByWeekday: Array<{ day: string; dayIndex: number; count: number }>;
  orderStatusInPeriod: Array<{ name: string; count: number; fill: string }>;
};

export function formatInventoryMoney(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function inPeriod(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function isLowStock(ingredient: Ingredient): boolean {
  const threshold = ingredient.lowStockThreshold ?? 0;
  if (ingredient.currentStock <= 0) return true;
  return threshold > 0 && ingredient.currentStock <= threshold;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function collectStockMovementsInPeriod(
  ingredients: Ingredient[],
  periodStart: Date,
  periodEnd: Date,
): IngredientStockLogEntry[] {
  const out: IngredientStockLogEntry[] = [];
  for (const ingredient of ingredients) {
    for (const entry of ingredient.stockLog) {
      if (inPeriod(entry.at, periodStart, periodEnd)) {
        out.push(entry);
      }
    }
  }
  return out;
}

function ingredientUnitPrice(ingredient: Ingredient | undefined): number | null {
  const price = ingredient?.purchaseUnitPrice;
  if (price == null || !Number.isFinite(price) || price < 0) return null;
  return price;
}

function ingredientsById(ingredients: Ingredient[]): Map<string, Ingredient> {
  return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
}

function lineEstimatedValue(
  line: PurchaseOrderLine,
  byId: Map<string, Ingredient>,
): number | null {
  const price = ingredientUnitPrice(byId.get(line.ingredientId));
  if (price == null || line.quantity <= 0) return null;
  return roundPurchaseUnitPrice(line.quantity * price);
}

function stockValueForIngredient(ingredient: Ingredient): number | null {
  const price = ingredientUnitPrice(ingredient);
  if (price == null || ingredient.currentStock <= 0) return null;
  return roundPurchaseUnitPrice(ingredient.currentStock * price);
}

function sumOrderLinesValue(
  lines: PurchaseOrderLine[],
  byId: Map<string, Ingredient>,
): { value: number; unpricedLines: number } {
  let value = 0;
  let unpricedLines = 0;
  for (const line of lines) {
    const lineValue = lineEstimatedValue(line, byId);
    if (lineValue == null) {
      if (line.quantity > 0) unpricedLines += 1;
      continue;
    }
    value += lineValue;
  }
  return { value: roundPurchaseUnitPrice(value), unpricedLines };
}

export function computeInventoryStatistics(
  input: InventoryStatisticsInput,
): InventoryStatisticsResult {
  const active = input.ingredients.filter((i) => i.active !== false);
  const emptyStockCount = active.filter((i) => i.currentStock <= 0).length;
  const lowStockCount = active.filter(isLowStock).length;

  const openOrdersList = input.orders.filter((o) => o.status === "open");
  const openOrders = openOrdersList.length;
  const openOrderLines = openOrdersList.reduce((s, o) => s + o.lines.length, 0);

  const ordersInPeriod = input.orders.filter((o) =>
    inPeriod(o.createdAt, input.periodStart, input.periodEnd),
  );
  const closedOrdersInPeriod = ordersInPeriod.filter(
    (o) => o.status === "closed",
  ).length;
  const orderLinesInPeriod = ordersInPeriod.reduce(
    (s, o) => s + o.lines.length,
    0,
  );

  const movements = collectStockMovementsInPeriod(
    input.ingredients,
    input.periodStart,
    input.periodEnd,
  );
  const deliveriesInPeriod = movements.filter(
    (e) => e.kind === "stock_from_delivery",
  ).length;
  const invoiceMovementsInPeriod = movements.filter(
    (e) =>
      e.kind === "stock_from_invoice" ||
      e.kind === "stock_from_invoice_correction",
  ).length;

  const movementCounts = new Map<string, number>();
  for (const entry of movements) {
    movementCounts.set(entry.kind, (movementCounts.get(entry.kind) ?? 0) + 1);
  }
  const byMovementKind = [...movementCounts.entries()]
    .map(([kind, count]) => ({
      kind,
      label: MOVEMENT_LABELS[kind] ?? kind,
      count,
      fill: MOVEMENT_COLORS[kind] ?? "var(--muted-foreground)",
    }))
    .sort((a, b) => b.count - a.count);

  const categoryCounts = new Map<string, number>();
  for (const ingredient of active) {
    const name =
      input.categoryNames.get(ingredient.categoryId) ?? "Ohne Kategorie";
    categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  }
  const byCategory = [...categoryCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topCategory = byCategory[0]?.name ?? null;

  const supplierCounts = new Map<string, number>();
  for (const ingredient of active) {
    const name =
      input.supplierNames.get(ingredient.supplierId) ?? "Ohne Lieferant";
    supplierCounts.set(name, (supplierCounts.get(name) ?? 0) + 1);
  }
  const bySupplier = [...supplierCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const orderSupplierCounts = new Map<string, number>();
  for (const order of ordersInPeriod) {
    const name = order.supplierName?.trim() || "Unbekannt";
    orderSupplierCounts.set(name, (orderSupplierCounts.get(name) ?? 0) + 1);
  }
  const byOrderSupplier = [...orderSupplierCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const topOrderSupplier = byOrderSupplier[0]?.name ?? null;

  const monthCounts = new Map<string, number>();
  for (const order of ordersInPeriod) {
    const key = monthKey(order.createdAt);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const ordersByMonth = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({
      month: formatMonthLabel(key),
      count,
    }));

  const weekdayCounts = new Map<number, number>();
  for (const order of ordersInPeriod) {
    const d = new Date(order.createdAt).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const ordersByWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  const openInPeriod = ordersInPeriod.filter((o) => o.status === "open").length;
  const orderStatusInPeriod = [
    {
      name: "Offen",
      count: openInPeriod,
      fill: "var(--chart-4)",
    },
    {
      name: "Abgeschlossen",
      count: closedOrdersInPeriod,
      fill: "var(--chart-1)",
    },
  ].filter((row) => row.count > 0);

  const byIngredientId = ingredientsById(input.ingredients);
  const pricedActive = active.filter(
    (ingredient) => ingredientUnitPrice(ingredient) != null,
  );
  const pricedIngredientsCount = pricedActive.length;
  const unpricedIngredientsCount = active.length - pricedIngredientsCount;

  let totalStockValue = 0;
  const stockValueCategoryTotals = new Map<string, number>();
  for (const ingredient of active) {
    const value = stockValueForIngredient(ingredient);
    if (value == null) continue;
    totalStockValue += value;
    const categoryName =
      input.categoryNames.get(ingredient.categoryId) ?? "Ohne Kategorie";
    stockValueCategoryTotals.set(
      categoryName,
      roundPurchaseUnitPrice(
        (stockValueCategoryTotals.get(categoryName) ?? 0) + value,
      ),
    );
  }
  totalStockValue = roundPurchaseUnitPrice(totalStockValue);

  const avgPurchasePrice =
    pricedActive.length > 0
      ? roundPurchaseUnitPrice(
          pricedActive.reduce(
            (sum, ingredient) => sum + (ingredientUnitPrice(ingredient) ?? 0),
            0,
          ) / pricedActive.length,
        )
      : null;

  const stockValueByCategory = [...stockValueCategoryTotals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  let openOrdersValue = 0;
  for (const order of openOrdersList) {
    openOrdersValue += sumOrderLinesValue(order.lines, byIngredientId).value;
  }
  openOrdersValue = roundPurchaseUnitPrice(openOrdersValue);

  let ordersValueInPeriod = 0;
  let unpricedOrderLinesInPeriod = 0;
  const orderValueMonthTotals = new Map<string, number>();
  const orderValueSupplierTotals = new Map<string, number>();
  for (const order of ordersInPeriod) {
    const { value, unpricedLines } = sumOrderLinesValue(
      order.lines,
      byIngredientId,
    );
    ordersValueInPeriod += value;
    unpricedOrderLinesInPeriod += unpricedLines;
    const month = monthKey(order.createdAt);
    orderValueMonthTotals.set(
      month,
      roundPurchaseUnitPrice((orderValueMonthTotals.get(month) ?? 0) + value),
    );
    const supplierName = order.supplierName?.trim() || "Unbekannt";
    orderValueSupplierTotals.set(
      supplierName,
      roundPurchaseUnitPrice(
        (orderValueSupplierTotals.get(supplierName) ?? 0) + value,
      ),
    );
  }
  ordersValueInPeriod = roundPurchaseUnitPrice(ordersValueInPeriod);

  const orderValueByMonth = [...orderValueMonthTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      month: formatMonthLabel(key),
      value,
    }));

  const orderValueBySupplier = [...orderValueSupplierTotals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  let deliveredValueInPeriod = 0;
  for (const order of input.orders) {
    for (const line of order.lines) {
      if (
        !line.deliveredAt ||
        !inPeriod(line.deliveredAt, input.periodStart, input.periodEnd)
      ) {
        continue;
      }
      const lineValue = lineEstimatedValue(line, byIngredientId);
      if (lineValue != null) deliveredValueInPeriod += lineValue;
    }
  }
  deliveredValueInPeriod = roundPurchaseUnitPrice(deliveredValueInPeriod);

  return {
    activeIngredients: active.length,
    emptyStockCount,
    lowStockCount,
    openOrders,
    openOrderLines,
    ordersInPeriod: ordersInPeriod.length,
    closedOrdersInPeriod,
    orderLinesInPeriod,
    stockMovementsInPeriod: movements.length,
    deliveriesInPeriod,
    invoiceMovementsInPeriod,
    topCategory,
    topOrderSupplier,
    pricedIngredientsCount,
    unpricedIngredientsCount,
    totalStockValue,
    avgPurchasePrice,
    openOrdersValue,
    ordersValueInPeriod,
    deliveredValueInPeriod,
    unpricedOrderLinesInPeriod,
    byCategory,
    bySupplier,
    byOrderSupplier,
    stockValueByCategory,
    orderValueBySupplier,
    byMovementKind,
    ordersByMonth,
    orderValueByMonth,
    ordersByWeekday,
    orderStatusInPeriod,
  };
}
