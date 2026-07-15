import {
  downloadTableCsv,
  downloadTablePdf,
  type TableDocumentExportOptions,
} from "@/lib/export/table-document-export";
import { resolveInventoryUnitDisplayLabel } from "@/lib/inventory/inventory-unit-label-de";
import { sortPurchaseOrderLines } from "@/lib/inventory/sort-purchase-order-lines";
import {
  DEFAULT_PURCHASE_ORDER_LINE_EXPORT_FILTERS,
  filterPurchaseOrderLinesForExport,
  type PurchaseOrderLineExportFilters,
} from "@/lib/inventory/purchase-order-line-export-filters";
import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import type { PurchaseOrder } from "@/lib/types/purchase-order";

const HEADERS = [
  "Lieferant",
  "Status",
  "Erstellt",
  "Lieferdatum",
  "Zutat",
  "Marke",
  "Bestand",
  "Menge",
  "Einheit",
  "Geliefert",
] as const;

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function formatWhen(iso: string): string {
  try {
    return whenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDeliveryYmd(ymd: string | null): string {
  if (!ymd) return "";
  try {
    return dateFmt.format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

export type PurchaseOrdersExportContext = {
  orders: PurchaseOrder[];
  ingredients: Ingredient[];
  categories: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
};

function stockForIngredient(
  ingredients: Ingredient[],
  ingredientId: string,
): string {
  const hit = ingredients.find((i) => i.id === ingredientId);
  return hit != null ? String(hit.currentStock) : "";
}

export function buildPurchaseOrdersExportRows(
  ctx: PurchaseOrdersExportContext,
): string[][] {
  const rows: string[][] = [];
  const sortedOrders = [...ctx.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  for (const order of sortedOrders) {
    const status = order.status === "open" ? "Offen" : "Abgeschlossen";
    const created = formatWhen(order.createdAt);
    const delivery = formatDeliveryYmd(order.deliveryDate);

    if (order.lines.length === 0) {
      rows.push([
        order.supplierName,
        status,
        created,
        delivery,
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      continue;
    }

    const sortedLines = sortPurchaseOrderLines(
      order.lines,
      ctx.ingredients,
      ctx.categories,
      "categoryId",
      "asc",
      ctx.units,
    );

    for (const line of sortedLines) {
      rows.push([
        order.supplierName,
        status,
        created,
        delivery,
        line.ingredientName,
        line.brandLabel?.trim() ?? "",
        stockForIngredient(ctx.ingredients, line.ingredientId),
        String(line.quantity),
        resolveInventoryUnitDisplayLabel(line.unitId, ctx.units, line.unitLabel),
        line.deliveredAt ? "Ja" : "Nein",
      ]);
    }
  }

  return rows;
}

export function purchaseOrdersExportLineCount(
  ctx: PurchaseOrdersExportContext,
): number {
  return buildPurchaseOrdersExportRows(ctx).length;
}

/** CSV/PDF-Quelle für Tabellen-Export einer einzelnen Bestellung (Vollbild-Overlay). */
export function buildPurchaseOrderTableExport(
  order: PurchaseOrder,
  ctx: Pick<PurchaseOrdersExportContext, "ingredients" | "categories" | "units">,
  filters: PurchaseOrderLineExportFilters = DEFAULT_PURCHASE_ORDER_LINE_EXPORT_FILTERS,
): TableDocumentExportOptions {
  const filteredLines = sortPurchaseOrderLines(
    filterPurchaseOrderLinesForExport(order.lines, ctx.ingredients, filters),
    ctx.ingredients,
    ctx.categories,
    "categoryId",
    "asc",
    ctx.units,
  );

  const status = order.status === "open" ? "Offen" : "Abgeschlossen";
  const created = formatWhen(order.createdAt);
  const delivery = formatDeliveryYmd(order.deliveryDate);

  const rows = filteredLines.map((line) => [
    order.supplierName,
    status,
    created,
    delivery,
    line.ingredientName,
    line.brandLabel?.trim() ?? "",
    stockForIngredient(ctx.ingredients, line.ingredientId),
    String(line.quantity),
    resolveInventoryUnitDisplayLabel(line.unitId, ctx.units, line.unitLabel),
    line.deliveredAt ? "Ja" : "Nein",
  ]);

  const lineCount = filteredLines.length;
  return {
    documentTitle: `Bestellung · ${order.supplierName}`,
    filenamePrefix: "bestellung",
    headers: [...HEADERS],
    rows,
    summaryLine: `${lineCount} Position${lineCount === 1 ? "" : "en"}`,
    orientation: "landscape",
    columnStyles: {
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 16, halign: "right" },
    },
  };
}

export function downloadPurchaseOrdersCsv(
  ctx: PurchaseOrdersExportContext,
  options?: { restaurantName?: string },
): void {
  const rows = buildPurchaseOrdersExportRows(ctx);
  const orderCount = ctx.orders.length;
  downloadTableCsv({
    documentTitle: "Bestellungen",
    filenamePrefix: "bestellungen",
    headers: HEADERS,
    rows,
    restaurantName: options?.restaurantName,
    summaryLine: `${orderCount} Bestellung${orderCount === 1 ? "" : "en"} · ${rows.length} Position${rows.length === 1 ? "" : "en"}`,
  });
}

export async function downloadPurchaseOrdersPdf(
  ctx: PurchaseOrdersExportContext,
  options?: { restaurantName?: string },
): Promise<void> {
  const rows = buildPurchaseOrdersExportRows(ctx);
  const orderCount = ctx.orders.length;
  await downloadTablePdf({
    documentTitle: "Bestellungen",
    filenamePrefix: "bestellungen",
    headers: HEADERS,
    rows,
    restaurantName: options?.restaurantName,
    summaryLine: `${orderCount} Bestellung${orderCount === 1 ? "" : "en"} · ${rows.length} Position${rows.length === 1 ? "" : "en"}`,
    orientation: "landscape",
    columnStyles: {
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 16, halign: "right" },
    },
  });
}
