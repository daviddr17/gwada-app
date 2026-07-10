import { downloadBlob } from "@/lib/export/download-blob";
import { escapeCsvCell } from "@/lib/export/escape-csv-cell";
import { labelForTagId } from "@/lib/constants/menu-labels";
import { applyJsPdfPageNumbers } from "@/lib/pdf/jspdf-page-numbers";
import {
  isCategoryActive,
  isMenuItemActive,
  normalizeMenuAvailabilityYmd,
  sortItemsInCategoryForDisplay,
} from "@/lib/menu/item-utils";
import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuTaxonomyDefinition,
} from "@/lib/types/menu";

const HEADERS = [
  "Kategorie",
  "Nr.",
  "Gericht",
  "Beschreibung",
  "Preis (EUR)",
  "Status",
  "Anzeige von",
  "Anzeige bis",
  "Eigenschaften",
] as const;

const priceCsvFmt = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type MenuExportContext = {
  categories: MenuCategoryDefinition[];
  items: MenuItem[];
  tagDefinitions: readonly MenuTaxonomyDefinition[];
};

export function menuExportTotals(ctx: MenuExportContext): {
  dishCount: number;
  categoryCount: number;
} {
  const categoryIds = new Set(ctx.items.map((i) => i.category));
  return {
    dishCount: ctx.items.length,
    categoryCount: categoryIds.size,
  };
}

function itemToRow(
  item: MenuItem,
  categoryName: string,
  tagDefinitions: readonly MenuTaxonomyDefinition[],
): string[] {
  const tags = item.tags
    .map((id) => labelForTagId(id, tagDefinitions))
    .join(", ");
  return [
    categoryName,
    item.listNumber != null ? String(item.listNumber) : "",
    item.name.trim(),
    item.description.trim(),
    priceCsvFmt.format(item.price),
    isMenuItemActive(item) ? "Aktiv" : "Inaktiv",
    normalizeMenuAvailabilityYmd(item.availableFrom) ?? "",
    normalizeMenuAvailabilityYmd(item.availableTo) ?? "",
    tags,
  ];
}

export function buildMenuExportRows(ctx: MenuExportContext): string[][] {
  const rows: string[][] = [];
  const catById = new Map(ctx.categories.map((c) => [c.id, c]));

  for (const cat of ctx.categories) {
    const catItems = sortItemsInCategoryForDisplay(
      ctx.items.filter((i) => i.category === cat.id),
    );
    if (catItems.length === 0) continue;
    const catLabel = isCategoryActive(cat)
      ? cat.name
      : `${cat.name} (inaktiv)`;
    for (const item of catItems) {
      rows.push(itemToRow(item, catLabel, ctx.tagDefinitions));
    }
  }

  const orphan = ctx.items.filter((i) => !catById.has(i.category));
  if (orphan.length > 0) {
    for (const item of sortItemsInCategoryForDisplay(orphan)) {
      rows.push(itemToRow(item, "Ohne Kategorie", ctx.tagDefinitions));
    }
  }

  return rows;
}

export function downloadMenuCsv(
  ctx: MenuExportContext,
  options?: { restaurantName?: string },
): void {
  const rows = buildMenuExportRows(ctx);
  const totals = menuExportTotals(ctx);
  const meta: string[][] = [
    ["Speisekarte"],
    ...(options?.restaurantName?.trim()
      ? [["Restaurant", options.restaurantName.trim()]]
      : []),
    ["Export", new Date().toLocaleString("de-DE")],
    ["Gerichte", String(totals.dishCount)],
    ["Kategorien mit Einträgen", String(totals.categoryCount)],
    [],
    [...HEADERS],
  ];

  const lines = [
    ...meta.map((r) => r.map(escapeCsvCell).join(";")),
    ...rows.map((r) => r.map(escapeCsvCell).join(";")),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(`speisekarte-${ymdLocal(new Date())}.csv`, blob);
}

export async function downloadMenuPdf(
  ctx: MenuExportContext,
  options?: { restaurantName?: string },
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const rows = buildMenuExportRows(ctx);
  const totals = menuExportTotals(ctx);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text("Speisekarte", 14, 16);
  doc.setFontSize(10);
  let y = 22;
  if (options?.restaurantName?.trim()) {
    doc.text(options.restaurantName.trim(), 14, y);
    y += 5;
  }
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text(
    `${totals.dishCount} Gericht${totals.dishCount === 1 ? "" : "e"} · ${totals.categoryCount} Kategorie${totals.categoryCount === 1 ? "" : "n"}`,
    14,
    y + 2,
  );
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Export ${new Date().toLocaleString("de-DE")}`, 14, y + 2);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 6,
    head: [HEADERS as unknown as string[]],
    body: rows,
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
      minCellHeight: 12,
      valign: "middle",
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: 255,
      fontStyle: "bold",
      minCellHeight: 10,
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 52 },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 18 },
      6: { cellWidth: 40 },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 10, right: 10, bottom: 14 },
  });

  applyJsPdfPageNumbers(doc);

  doc.save(`speisekarte-${ymdLocal(new Date())}.pdf`);
}
