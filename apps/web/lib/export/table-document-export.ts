import type { jsPDF } from "jspdf";
import { downloadBlob } from "@/lib/export/download-blob";
import { escapeCsvCell } from "@/lib/export/escape-csv-cell";
import { printJsPdfDocument, type PrintJsPdfResult } from "@/lib/export/print-jspdf-document";
import { resolveTablePdfRowStyles } from "@/lib/export/table-export-rows-per-page";
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
  /** Ziel-Zeilen pro A4-Seite — steuert Zeilenhöhe/Schrift im PDF. */
  rowsPerPage?: number | null;
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
  rowsPerPage,
  columnStyles,
}: TableDocumentExportOptions): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const rowStyles = resolveTablePdfRowStyles({ rowsPerPage, orientation });

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
      fontSize: rowStyles.fontSize,
      cellPadding: rowStyles.cellPadding,
      minCellHeight: rowStyles.minCellHeight,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: 255,
      fontStyle: "bold",
      fontSize: Math.min(9, rowStyles.fontSize + 0.5),
      minCellHeight: rowStyles.headMinCellHeight,
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
): Promise<PrintJsPdfResult> {
  if (options.rows.length === 0) return "printed";
  const doc = await buildTablePdfDocument(options);
  return printJsPdfDocument(doc, {
    shareFilename: `${options.filenamePrefix}-${ymdLocal(new Date())}.pdf`,
    htmlFallback: {
      documentTitle: options.documentTitle,
      headers: options.headers,
      rows: options.rows,
      restaurantName: options.restaurantName,
      summaryLine: options.summaryLine,
    },
  });
}

export async function downloadTablePdf({
  documentTitle,
  filenamePrefix,
  ...rest
}: TableDocumentExportOptions): Promise<void> {
  const doc = await buildTablePdfDocument({ documentTitle, filenamePrefix, ...rest });
  doc.save(`${filenamePrefix}-${ymdLocal(new Date())}.pdf`);
}
