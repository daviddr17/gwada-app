import "server-only";

import { loadPDFDocument } from "@/lib/pos/load-pdf-document";

export type StaffContractPdfSignature = {
  name: string;
  signedAtLabel: string;
  imagePng: Buffer;
};

export type StaffContractPdfInput = {
  title: string;
  paragraphs: Array<{ heading: string | null; body: string }>;
  employerSignature?: StaffContractPdfSignature | null;
  employeeSignature?: StaffContractPdfSignature | null;
};

function wrapText(
  doc: InstanceType<ReturnType<typeof loadPDFDocument>>,
  text: string,
  x: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = text.split(/\n/);
  let y = doc.y;
  for (const paragraph of lines) {
    if (!paragraph.trim()) {
      y += lineHeight * 0.5;
      continue;
    }
    doc.text(paragraph, x, y, { width: maxWidth, align: "justify" });
    y = doc.y + lineHeight * 0.35;
  }
  doc.y = y;
  return y;
}

function pageNumberY(doc: InstanceType<ReturnType<typeof loadPDFDocument>>): number {
  return doc.page.height - doc.page.margins.bottom + 4;
}

function contentBottomLimit(
  doc: InstanceType<ReturnType<typeof loadPDFDocument>>,
): number {
  return pageNumberY(doc) - 12;
}

function addPageNumbers(
  doc: InstanceType<ReturnType<typeof loadPDFDocument>>,
  x: number,
  pageWidth: number,
) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  const footerY = pageNumberY(doc);
  const rightEdge = x + pageWidth;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#444444")
      .text(`Seite ${i + 1}/${totalPages}`, rightEdge - 72, footerY, {
        width: 72,
        align: "right",
        lineBreak: false,
      });
    doc.fillColor("#000000");
  }
}

export async function generateStaffContractPdfBuffer(
  input: StaffContractPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const PDFDocument = loadPDFDocument();
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 72, left: 56, right: 56 },
      bufferPages: true,
      info: { Title: input.title },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = doc.page.margins.left;
    const bottomLimit = () => contentBottomLimit(doc);

    doc.font("Helvetica-Bold").fontSize(16).text(input.title, x, doc.y, {
      width: pageWidth,
      align: "center",
    });
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(11);

    for (const paragraph of input.paragraphs) {
      if (paragraph.heading?.trim()) {
        if (doc.y > bottomLimit()) doc.addPage();
        doc.font("Helvetica-Bold").fontSize(12).text(paragraph.heading.trim(), x, doc.y, {
          width: pageWidth,
        });
        doc.moveDown(0.4);
        doc.font("Helvetica").fontSize(11);
      }
      if (paragraph.body.trim()) {
        if (doc.y > bottomLimit()) doc.addPage();
        wrapText(doc, paragraph.body.trim(), x, pageWidth, 14);
        doc.moveDown(0.8);
      }
    }

    const signatures = [
      { label: "Arbeitgeber", sig: input.employerSignature },
      { label: "Arbeitnehmer", sig: input.employeeSignature },
    ].filter((s) => s.sig);

    if (signatures.length > 0) {
      doc.moveDown(1);
      if (doc.y > bottomLimit()) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(12).text("Unterschriften", x, doc.y);
      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(10);

      for (const { label, sig } of signatures) {
        if (!sig) continue;
        if (doc.y > bottomLimit()) doc.addPage();
        doc.font("Helvetica-Bold").text(label, x, doc.y);
        doc.moveDown(0.3);
        doc.font("Helvetica").text(sig.name, x, doc.y);
        doc.text(`Datum: ${sig.signedAtLabel}`, x, doc.y);
        doc.moveDown(0.3);
        try {
          doc.image(sig.imagePng, x, doc.y, { width: 180, height: 60 });
          doc.y += 68;
        } catch {
          doc.text("[Unterschrift]", x, doc.y);
          doc.moveDown(0.8);
        }
        doc.moveDown(0.6);
      }
    }

    addPageNumbers(doc, x, pageWidth);
    doc.flushPages();
    doc.end();
  });
}

export function dataUrlToPngBuffer(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match?.[1]) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}
