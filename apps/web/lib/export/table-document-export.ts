import type { jsPDF } from "jspdf";
import { downloadBlob } from "@/lib/export/download-blob";
import { escapeCsvCell } from "@/lib/export/escape-csv-cell";
import { printJsPdfDocument } from "@/lib/export/print-jspdf-document";
import { applyJsPdfPageNumbers } from "@/lib/pdf/jspdf-page-numbers";

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type TableDocumentExportOptions = {
  documentTitle: string;
  filenamePrefix: string;
  headers: readonly string[];
  rows: string[][];
  restaurantName?: string;
  summaryLine?: string;
  orientation?: "landscape" | "portrait";
  columnStyles?: Record<number, { cellWidth?: number; halign?: "left" | "center" | "right" }>;
};

export function downloadTableCsv({
  documentTitle,
  filenamePrefix,
  headers,
  rows,
  restaurantName,
  summaryLine,
}: TableDocumentExportOptions): void {
  const meta: string[][] = [
    [documentTitle],
    ...(restaurantName?.trim()
      ? [["Restaurant", restaurantName.trim()]]
      : []),
    ["Export", new Date().toLocaleString("de-DE")],
    ...(summaryLine ? [["Übersicht", summaryLine]] : []),
    [],
    [...headers],
  ];

  const lines = [
    ...meta.map((r) => r.map(escapeCsvCell).join(";")),
    ...rows.map((r) => r.map(escapeCsvCell).join(";")),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(`${filenamePrefix}-${ymdLocal(new Date())}.csv`, blob);
}

export async function buildTablePdfDocument({
  documentTitle,
  headers,
  rows,
  restaurantName,
  summaryLine,
  orientation = "landscape",
  columnStyles,
}: TableDocumentExportOptions): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text(documentTitle, 14, 16);
  doc.setFontSize(10);
  let y = 22;
  if (restaurantName?.trim()) {
    doc.text(restaurantName.trim(), 14, y);
    y += 5;
  }
  if (summaryLine?.trim()) {
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(summaryLine.trim(), 14, y + 2);
    y += 5;
  }
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Export ${new Date().toLocaleString("de-DE")}`, 14, y + 2);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 6,
    head: [headers as unknown as string[]],
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
    ...(columnStyles ? { columnStyles } : {}),
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 10, right: 10, bottom: 14 },
  });

  applyJsPdfPageNumbers(doc);

  return doc;
}

export async function printTablePdf(
  options: TableDocumentExportOptions,
): Promise<void> {
  if (options.rows.length === 0) return;
  const doc = await buildTablePdfDocument(options);
  await printJsPdfDocument(doc);
}

export async function downloadTablePdf({
  documentTitle,
  filenamePrefix,
  ...rest
}: TableDocumentExportOptions): Promise<void> {
  const doc = await buildTablePdfDocument({ documentTitle, filenamePrefix, ...rest });
  doc.save(`${filenamePrefix}-${ymdLocal(new Date())}.pdf`);
}
