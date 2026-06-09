import "server-only";

import type { AccountingPdfRenderContext } from "@/lib/accounting/accounting-document-design";
import {
  ACCOUNTING_PDF_MARGIN_MM,
  ACCOUNTING_PDF_ROW_HEIGHT_MM,
  accountingPdfLineHeightMm,
  accountingPdfTextBaselineY,
  headerZoneEndMm,
  LAYOUT_GRID_COLS,
  layoutBlockFontSizePt,
  layoutBlockEffectiveAlign,
  layoutBlockLogoDrawRect,
  layoutZoneRows,
  metaZoneEndY,
  resolveLayoutBlockPdfText,
  resolveMetaBlockPdfText,
} from "@/lib/accounting/accounting-document-layout";
import type {
  AccountingInvoiceRow,
  AccountingLineItem,
  AccountingQuotationRow,
  AccountingRecipientSnapshot,
  AccountingTotals,
} from "@/lib/types/accounting";
import type {
  AccountingDocumentFontFamily,
  AccountingLayoutBlock,
  AccountingLayoutZone,
} from "@/lib/types/accounting-settings";

type SalesDocumentRow = AccountingInvoiceRow | AccountingQuotationRow;

/** Abstand vor der Positionstabelle und zwischen Tabelle und Gesamtsumme (mm). */
const LINE_ITEMS_TABLE_SPACE_TOP_MM = 16;
const LINE_ITEMS_TABLE_SPACE_BOTTOM_MM = 12;

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount);
}

function jsPdfFont(family: AccountingDocumentFontFamily): string {
  return family;
}

function drawMultiline(
  doc: import("jspdf").jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: "left" | "center" | "right",
): number {
  const lineHeight = accountingPdfLineHeightMm();
  const lines = doc.splitTextToSize(text, maxWidth);
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i] as string, x, y + i * lineHeight, { align, maxWidth });
  }
  return y + lines.length * lineHeight;
}

function renderLayoutZone(
  doc: import("jspdf").jsPDF,
  zone: AccountingLayoutZone,
  blocks: AccountingLayoutBlock[],
  ctx: AccountingPdfRenderContext,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  contentWidth: number,
): void {
  const zoneBlocks = blocks.filter((b) => b.zone === zone);
  if (!zoneBlocks.length) return;

  const rowHeight = ACCOUNTING_PDF_ROW_HEIGHT_MM[zone];
  const maxRow = Math.max(
    ...zoneBlocks.map((b) => b.row + (b.rowSpan ?? 1) - 1),
  );

  for (const block of zoneBlocks) {
    const width = (block.colSpan / LAYOUT_GRID_COLS) * contentWidth;
    const xLeft = margin + (block.col / LAYOUT_GRID_COLS) * contentWidth;
    const align = layoutBlockEffectiveAlign(block);
    const x =
      align === "right"
        ? xLeft + width
        : align === "center"
          ? xLeft + width / 2
          : xLeft;
    const rowTopY =
      zone === "header"
        ? margin + block.row * rowHeight
        : pageHeight -
          margin -
          (maxRow - block.row + 1) * rowHeight;

    if (block.type === "logo" && ctx.logo) {
      const { drawWidth, drawHeight, offsetX, offsetY } =
        layoutBlockLogoDrawRect(
          block,
          zone,
          contentWidth,
          align,
          ctx.logo.widthPx,
          ctx.logo.heightPx,
        );
      try {
        doc.addImage(
          ctx.logo.base64,
          ctx.logo.format,
          xLeft + offsetX,
          rowTopY + offsetY,
          drawWidth,
          drawHeight,
        );
      } catch {
        /* optional */
      }
      continue;
    }

    const text = resolveLayoutBlockPdfText(block, ctx.company);
    if (!text.trim()) continue;

    const fontSize = layoutBlockFontSizePt(block, zone);
    doc.setFontSize(fontSize);
    if (zone === "footer") doc.setTextColor(90);
    drawMultiline(
      doc,
      text,
      x,
      accountingPdfTextBaselineY(rowTopY),
      width,
      align,
    );
    doc.setTextColor(0);
  }
}

function renderMetaZone(
  doc: import("jspdf").jsPDF,
  blocks: AccountingLayoutBlock[],
  row: SalesDocumentRow,
  kind: "invoice" | "quotation",
  startY: number,
  margin: number,
  contentWidth: number,
): void {
  const metaBlocks = blocks.filter((b) => b.zone === "meta");
  if (!metaBlocks.length) return;

  const rowHeight = ACCOUNTING_PDF_ROW_HEIGHT_MM.meta;
  for (const block of metaBlocks) {
    const width = (block.colSpan / LAYOUT_GRID_COLS) * contentWidth;
    const xLeft = margin + (block.col / LAYOUT_GRID_COLS) * contentWidth;
    const align = layoutBlockEffectiveAlign(block);
    const x =
      align === "right"
        ? xLeft + width
        : align === "center"
          ? xLeft + width / 2
          : xLeft;
    const rowTopY = startY + block.row * rowHeight;
    const text = resolveMetaBlockPdfText(block, row, kind);
    if (!text.trim()) continue;

    const fontSize = layoutBlockFontSizePt(block, "meta");
    doc.setFontSize(fontSize);
    drawMultiline(
      doc,
      text,
      x,
      accountingPdfTextBaselineY(rowTopY),
      width,
      align,
    );
  }
}

function drawDocumentPageNumbers(
  doc: import("jspdf").jsPDF,
  margin: number,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `${page}/${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: "right" },
    );
    doc.setTextColor(0);
  }
}

export async function generateGwadaSalesDocumentPdf(
  row: SalesDocumentRow,
  kind: "invoice" | "quotation",
  ctx: AccountingPdfRenderContext,
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const font = jsPdfFont(ctx.design.fontFamily);
  doc.setFont(font);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = ACCOUNTING_PDF_MARGIN_MM;
  const contentWidth = pageWidth - margin * 2;
  const blocks = ctx.design.layoutBlocks;

  renderLayoutZone(
    doc,
    "header",
    blocks,
    ctx,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
  );

  let y = headerZoneEndMm(blocks);

  renderMetaZone(doc, blocks, row, kind, y, margin, contentWidth);
  y = metaZoneEndY(blocks, y);

  const recipient = row.recipient_snapshot as AccountingRecipientSnapshot;
  const totals = row.totals as AccountingTotals;
  const lines = (row.line_items ?? []) as AccountingLineItem[];

  const body = lines
    .filter((l) => l.type !== "text" || l.name.trim())
    .map((l) => [
      l.name,
      String(l.quantity),
      l.unitName,
      formatMoney(l.unitPrice, row.currency),
      formatMoney(l.lineAmount, row.currency),
    ]);

  autoTable(doc, {
    startY: y + LINE_ITEMS_TABLE_SPACE_TOP_MM,
    head: [["Bezeichnung", "Menge", "Einheit", "Einzelpreis", "Betrag"]],
    body,
    styles: { fontSize: 9, font },
    headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    margin: {
      bottom:
        layoutZoneRows("footer") * ACCOUNTING_PDF_ROW_HEIGHT_MM.footer +
        margin +
        8,
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 40;

  doc.setFontSize(11);
  doc.text(
    `Gesamt (brutto): ${formatMoney(totals.totalGross ?? 0, row.currency)}`,
    margin,
    finalY + LINE_ITEMS_TABLE_SPACE_BOTTOM_MM,
  );

  renderLayoutZone(
    doc,
    "footer",
    blocks,
    ctx,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
  );

  drawDocumentPageNumbers(doc, margin);

  return Buffer.from(doc.output("arraybuffer"));
}
