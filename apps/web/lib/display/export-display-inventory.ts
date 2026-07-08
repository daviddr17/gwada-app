import { printTableDocument } from "@/lib/export/print-table-document";
import type { PrintJsPdfResult } from "@/lib/export/print-host";
import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";
import type { DisplayInventoryIngredientRow } from "@/lib/display/display-inventory-server";

const ALL = "all";

export type DisplayInventoryExportMode = "stock" | "order";

export type DisplayInventoryExportFilters = {
  supplierId: string;
  categoryId: string;
  productionSiteId: string;
  brandId: string;
  /** Nur im Modus „Bestellung“: Positionen mit Menge > 0. */
  onlyWithOrderQuantity: boolean;
};

export const DEFAULT_DISPLAY_INVENTORY_EXPORT_FILTERS: DisplayInventoryExportFilters =
  {
    supplierId: ALL,
    categoryId: ALL,
    productionSiteId: ALL,
    brandId: ALL,
    onlyWithOrderQuantity: false,
  };

const STOCK_HEADERS = [
  "Name",
  "Bestand",
  "Einheit",
  "Neuer Bestand",
  "Bestellung",
  "Lieferant",
  "Kategorie",
  "Produktion",
  "Marke",
] as const;

const ORDER_HEADERS = [
  "Lieferant",
  "Zutat",
  "Marke",
  "Bestand",
  "Menge",
  "Einheit",
  "Kategorie",
  "Produktion",
] as const;

const HANDWRITTEN_EMPTY = "";

export function countDisplayInventoryExportFilters(
  filters: DisplayInventoryExportFilters,
  mode: DisplayInventoryExportMode,
): number {
  let n = 0;
  if (filters.supplierId !== ALL) n += 1;
  if (filters.categoryId !== ALL) n += 1;
  if (filters.productionSiteId !== ALL) n += 1;
  if (filters.brandId !== ALL) n += 1;
  if (mode === "order" && filters.onlyWithOrderQuantity) n += 1;
  return n;
}

export function filterDisplayInventoryExportRows(
  rows: DisplayInventoryIngredientRow[],
  filters: DisplayInventoryExportFilters,
  mode: DisplayInventoryExportMode,
): DisplayInventoryIngredientRow[] {
  let result = rows;
  if (filters.supplierId !== ALL) {
    result = result.filter((r) => r.supplierId === filters.supplierId);
  }
  if (filters.categoryId !== ALL) {
    result = result.filter((r) => r.categoryId === filters.categoryId);
  }
  if (filters.productionSiteId !== ALL) {
    result = result.filter((r) => r.productionSiteId === filters.productionSiteId);
  }
  if (filters.brandId !== ALL) {
    result = result.filter((r) => r.brandId === filters.brandId);
  }
  if (mode === "order" && filters.onlyWithOrderQuantity) {
    result = result.filter((r) => r.orderQuantity > 0);
  }
  return result;
}

function stockRowToExport(row: DisplayInventoryIngredientRow): string[] {
  return [
    row.name.trim(),
    String(row.currentStock),
    row.unitLabel,
    HANDWRITTEN_EMPTY,
    HANDWRITTEN_EMPTY,
    row.supplierName,
    row.categoryName,
    row.productionSiteName,
    row.brandLabel,
  ];
}

function orderRowToExport(row: DisplayInventoryIngredientRow): string[] {
  return [
    row.supplierName,
    row.name.trim(),
    row.brandLabel,
    String(row.currentStock),
    String(row.orderQuantity),
    row.unitLabel,
    row.categoryName,
    row.productionSiteName,
  ];
}

export function buildDisplayInventoryExportRows(
  rows: DisplayInventoryIngredientRow[],
  mode: DisplayInventoryExportMode,
): string[][] {
  const sorted = [...rows].sort((a, b) => {
    if (mode === "order") {
      const supplier = a.supplierName.localeCompare(b.supplierName, "de");
      if (supplier !== 0) return supplier;
    }
    return a.name.localeCompare(b.name, "de");
  });
  return sorted.map((row) =>
    mode === "stock" ? stockRowToExport(row) : orderRowToExport(row),
  );
}

function displayInventoryHeaders(mode: DisplayInventoryExportMode): readonly string[] {
  return mode === "stock" ? STOCK_HEADERS : ORDER_HEADERS;
}

export async function printDisplayInventory(
  rows: DisplayInventoryIngredientRow[],
  mode: DisplayInventoryExportMode,
  options?: { restaurantName?: string },
): Promise<PrintJsPdfResult> {
  const exportRows = buildDisplayInventoryExportRows(rows, mode);
  const isStock = mode === "stock";
  const summary = isStock
    ? `${exportRows.length} Zutat${exportRows.length === 1 ? "" : "en"} · Spalten „Neuer Bestand“ und „Bestellung“ zum handschriftlichen Eintragen`
    : `${exportRows.length} Position${exportRows.length === 1 ? "" : "en"}`;

  return printTableDocument({
    documentTitle: isStock ? "Bestand" : "Bestellung",
    headers: displayInventoryHeaders(mode),
    rows: exportRows,
    restaurantName: options?.restaurantName,
    summaryLine: summary,
    landscape: true,
    columnStyles: isStock
      ? {
          1: { cellWidth: 18, halign: "right" },
          2: { cellWidth: 22 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
        }
      : {
          3: { cellWidth: 16, halign: "right" },
          4: { cellWidth: 16, halign: "right" },
        },
  });
}

export function downloadDisplayInventoryCsv(
  rows: DisplayInventoryIngredientRow[],
  mode: DisplayInventoryExportMode,
  options?: { restaurantName?: string },
): void {
  const exportRows = buildDisplayInventoryExportRows(rows, mode);
  const isStock = mode === "stock";
  downloadTableCsv({
    documentTitle: isStock ? "Bestand" : "Bestellung",
    filenamePrefix: isStock ? "bestand" : "bestellung",
    headers: isStock ? STOCK_HEADERS : ORDER_HEADERS,
    rows: exportRows,
    restaurantName: options?.restaurantName,
    summaryLine: `${exportRows.length} Zutat${exportRows.length === 1 ? "" : "en"}`,
  });
}

export async function downloadDisplayInventoryPdf(
  rows: DisplayInventoryIngredientRow[],
  mode: DisplayInventoryExportMode,
  options?: { restaurantName?: string },
): Promise<void> {
  const exportRows = buildDisplayInventoryExportRows(rows, mode);
  const isStock = mode === "stock";
  const summary = isStock
    ? `${exportRows.length} Zutat${exportRows.length === 1 ? "" : "en"} · Spalten „Neuer Bestand“ und „Bestellung“ zum handschriftlichen Eintragen`
    : `${exportRows.length} Position${exportRows.length === 1 ? "" : "en"}`;

  await downloadTablePdf({
    documentTitle: isStock ? "Bestand" : "Bestellung",
    filenamePrefix: isStock ? "bestand" : "bestellung",
    headers: isStock ? STOCK_HEADERS : ORDER_HEADERS,
    rows: exportRows,
    restaurantName: options?.restaurantName,
    summaryLine: summary,
    orientation: "landscape",
    columnStyles: isStock
      ? {
          1: { cellWidth: 18, halign: "right" },
          2: { cellWidth: 22 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
        }
      : {
          3: { cellWidth: 16, halign: "right" },
          4: { cellWidth: 16, halign: "right" },
        },
  });
}
