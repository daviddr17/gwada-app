import {
  downloadTableCsv,
  downloadTablePdf,
  type TableDocumentExportOptions,
} from "@/lib/export/table-document-export";
import { inventoryUnitLabelDe } from "@/lib/inventory/inventory-unit-label-de";
import {
  filterIngredientsForTableExport,
  type InventoryTableExportFilters,
} from "@/lib/inventory/inventory-table-export-filters";
import { compareCategoryThenName } from "@/lib/inventory/sort-by-category";
import type {
  Ingredient,
  InventoryTaxonomyDefinition,
} from "@/lib/types/inventory";
import type { MenuItem } from "@/lib/types/menu";

const HEADERS = [
  "Name",
  "Bestand",
  "Einheit",
  "Neuer Bestand",
  "Bestellung",
  "Lieferant",
  "Kategorie",
  "Produktion",
  "Marke",
  "Status",
] as const;

const HANDWRITTEN_EMPTY = "";

export type InventoryExportContext = {
  ingredients: Ingredient[];
  suppliers: InventoryTaxonomyDefinition[];
  categories: InventoryTaxonomyDefinition[];
  productionSites: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
};

function nameById(
  items: InventoryTaxonomyDefinition[],
  id: string,
): string {
  const hit = items.find((i) => i.id === id);
  if (!hit) return "";
  return hit.active === false ? `${hit.name} (inaktiv)` : hit.name;
}

function ingredientToRow(
  row: Ingredient,
  ctx: InventoryExportContext,
): string[] {
  const unitLabel = inventoryUnitLabelDe(row.unit, nameById(ctx.units, row.unit) || undefined);
  return [
    row.name.trim(),
    String(row.currentStock),
    unitLabel,
    HANDWRITTEN_EMPTY,
    HANDWRITTEN_EMPTY,
    nameById(ctx.suppliers, row.supplierId),
    nameById(ctx.categories, row.categoryId),
    nameById(ctx.productionSites, row.productionSiteId),
    nameById(ctx.brands, row.brandId),
    row.active === false ? "Inaktiv" : "Aktiv",
  ];
}

export function buildInventoryExportRows(ctx: InventoryExportContext): string[][] {
  return [...ctx.ingredients]
    .sort((a, b) =>
      compareCategoryThenName(
        a.categoryId,
        a.name.trim(),
        b.categoryId,
        b.name.trim(),
        ctx.categories,
      ),
    )
    .map((row) => ingredientToRow(row, ctx));
}

export function buildInventoryTableExportOptions(
  ingredients: Ingredient[],
  filters: InventoryTableExportFilters,
  ctx: Omit<InventoryExportContext, "ingredients">,
  options?: { search?: string; menuItems?: MenuItem[] },
): TableDocumentExportOptions {
  const filtered = filterIngredientsForTableExport(ingredients, filters, {
    search: options?.search,
    menuItems: options?.menuItems,
    categories: ctx.categories,
  });
  const exportCtx: InventoryExportContext = { ...ctx, ingredients: filtered };
  const rows = filtered.map((row) => ingredientToRow(row, exportCtx));

  return {
    documentTitle: "Bestand",
    filenamePrefix: "bestand",
    headers: [...HEADERS],
    rows,
    summaryLine: `${filtered.length} Zutat${filtered.length === 1 ? "" : "en"}`,
    orientation: "landscape",
    columnStyles: {
      1: { cellWidth: 18, halign: "right" },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
    },
  };
}

export function downloadInventoryCsv(
  ctx: InventoryExportContext,
  options?: { restaurantName?: string },
): void {
  const rows = buildInventoryExportRows(ctx);
  downloadTableCsv({
    documentTitle: "Bestand",
    filenamePrefix: "bestand",
    headers: HEADERS,
    rows,
    restaurantName: options?.restaurantName,
    summaryLine: `${ctx.ingredients.length} Zutat${ctx.ingredients.length === 1 ? "" : "en"}`,
  });
}

export async function downloadInventoryPdf(
  ctx: InventoryExportContext,
  options?: { restaurantName?: string },
): Promise<void> {
  const rows = buildInventoryExportRows(ctx);
  await downloadTablePdf({
    documentTitle: "Bestand",
    filenamePrefix: "bestand",
    headers: HEADERS,
    rows,
    restaurantName: options?.restaurantName,
    summaryLine: `${ctx.ingredients.length} Zutat${ctx.ingredients.length === 1 ? "" : "en"} · Spalten „Neuer Bestand“ und „Bestellung“ zum handschriftlichen Eintragen`,
    orientation: "landscape",
    columnStyles: {
      1: { cellWidth: 18, halign: "right" },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
    },
  });
}
