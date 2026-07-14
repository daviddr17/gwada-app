import { printJsPdfDocument } from "@/lib/export/print-jspdf-document";
import { inventoryUnitLabelDe } from "@/lib/inventory/inventory-unit-label-de";
import { applyJsPdfPageNumbers } from "@/lib/pdf/jspdf-page-numbers";
import { formatRestaurantDateTime } from "@/lib/restaurant/restaurant-timezone";
import type { jsPDF } from "jspdf";

export type DisplayRecipeLine = {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  amount: number;
};

export type DisplayRecipeDish = {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  category_name: string;
  recipe: DisplayRecipeLine[];
};

export type DisplayRecipePrintOptions = {
  restaurantName?: string;
  timeZone?: string;
};

const RECIPE_HEADERS = ["Zutat", "Menge", "Einheit"] as const;

const eurFmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const amountFmt = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 3,
});

function formatRecipeAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  if (Number.isInteger(amount)) return String(amount);
  return amountFmt.format(amount);
}

function recipeLineToRow(line: DisplayRecipeLine): string[] {
  return [
    line.ingredient_name.trim(),
    formatRecipeAmount(line.amount),
    inventoryUnitLabelDe(line.unit),
  ];
}

export async function buildDisplayRecipePdfDocument(
  dish: DisplayRecipeDish,
  options?: DisplayRecipePrintOptions,
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = dish.name.trim() || "Rezept";

  doc.setFontSize(14);
  doc.text("Rezept", 14, 16);
  doc.setFontSize(10);
  let y = 22;
  if (options?.restaurantName?.trim()) {
    doc.text(options.restaurantName.trim(), 14, y);
    y += 5;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y + 4);
  doc.setFont("helvetica", "normal");
  y += 10;

  const metaParts: string[] = [];
  if (dish.category_name.trim()) metaParts.push(dish.category_name.trim());
  metaParts.push(eurFmt.format(dish.price));
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(metaParts.join(" · "), 14, y);
  y += 5;

  const description = dish.description.trim();
  if (description) {
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(description, 186);
    doc.text(wrapped, 14, y + 2);
    y += wrapped.length * 4 + 2;
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    `Gedruckt ${formatRestaurantDateTime(new Date(), options?.timeZone)}`,
    14,
    y + 2,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 6,
    head: [RECIPE_HEADERS as unknown as string[]],
    body: dish.recipe.map(recipeLineToRow),
    styles: {
      fontSize: 11,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
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
      1: { cellWidth: 24, halign: "right" },
      2: { cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 14, right: 14, bottom: 14 },
  });

  applyJsPdfPageNumbers(doc);

  return doc;
}

export async function printDisplayRecipe(
  dish: DisplayRecipeDish,
  options?: DisplayRecipePrintOptions,
): Promise<void> {
  if (dish.recipe.length === 0) return;
  const doc = await buildDisplayRecipePdfDocument(dish, options);
  await printJsPdfDocument(doc);
}
