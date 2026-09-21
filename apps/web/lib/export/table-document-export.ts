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

const PDF_HEADER_X = 14;
const PDF_HEADER_MARGIN_RIGHT = 10;

function pdfHeaderMaxWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - PDF_HEADER_X - PDF_HEADER_MARGIN_RIGHT;
}

/** Mehrzeiliger Kopf — verhindert Überlauf bei langen Summary-Zeilen (z. B. Arbeitszeiten). */
function writeWrappedPdfHeaderText(
  doc: jsPDF,
  text: string,
  startY: number,
  maxWidth: number,
  lineHeight: number,
): number {
  let y = startY;
  for (const paragraph of text.split(/\n/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    const lines = doc.splitTextToSize(trimmed, maxWidth);
    for (const line of lines) {
      doc.text(line, PDF_HEADER_X, y);
      y += lineHeight;
    }
  }
  return y;
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
  const headerMaxWidth = pdfHeaderMaxWidth(doc);

  doc.setFontSize(14);
  doc.text(documentTitle, PDF_HEADER_X, 16);
  doc.setFontSize(10);
  let y = 22;
  if (restaurantName?.trim()) {
    y = writeWrappedPdfHeaderText(
      doc,
      restaurantName.trim(),
      y,
      headerMaxWidth,
      4.5,
    );
  }
  if (summaryLine?.trim()) {
    doc.setFontSize(9);
    doc.setTextColor(40);
    y = writeWrappedPdfHeaderText(
      doc,
      summaryLine.trim(),
      y + 1,
      headerMaxWidth,
      4,
    );
    doc.setTextColor(0);
  }
  doc.setFontSize(8);
  doc.setTextColor(100);
  y = writeWrappedPdfHeaderText(
    doc,
    `Export ${new Date().toLocaleString("de-DE")}`,
    y + 1,
    headerMaxWidth,
    3.5,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 4,
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
