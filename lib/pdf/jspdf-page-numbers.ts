import type { jsPDF } from "jspdf";

/** Seitenzahl unten rechts: „1/3“, „2/3“ … */
export function applyJsPdfPageNumbers(
  doc: jsPDF,
  options?: { marginMm?: number; fontSize?: number },
): void {
  const margin = options?.marginMm ?? 10;
  const fontSize = options?.fontSize ?? 9;
  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFontSize(fontSize);
    doc.setTextColor(100);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(`${page}/${total}`, pageWidth - margin, pageHeight - margin, {
      align: "right",
    });
  }

  doc.setTextColor(0);
}
