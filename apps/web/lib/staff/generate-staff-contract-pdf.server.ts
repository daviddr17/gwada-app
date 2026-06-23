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

export async function generateStaffContractPdfBuffer(
  input: StaffContractPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const PDFDocument = loadPDFDocument();
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: { Title: input.title },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = doc.page.margins.left;

    doc.font("Helvetica-Bold").fontSize(16).text(input.title, x, doc.y, {
      width: pageWidth,
      align: "center",
    });
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(11);

    for (const paragraph of input.paragraphs) {
      if (paragraph.heading?.trim()) {
        doc.font("Helvetica-Bold").fontSize(12).text(paragraph.heading.trim(), x, doc.y, {
          width: pageWidth,
        });
        doc.moveDown(0.4);
        doc.font("Helvetica").fontSize(11);
      }
      if (paragraph.body.trim()) {
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
      doc.font("Helvetica-Bold").fontSize(12).text("Unterschriften", x, doc.y);
      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(10);

      for (const { label, sig } of signatures) {
        if (!sig) continue;
        if (doc.y > doc.page.height - 180) {
          doc.addPage();
        }
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

    const footerY = doc.page.height - doc.page.margins.bottom - 20;
    if (doc.y > footerY - 12) {
      doc.addPage();
    }
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666666")
      .text(
        "Elektronisch unterzeichnet ohne qualifizierte elektronische Signatur (QES/eIDAS).",
        x,
        footerY,
        { width: pageWidth, align: "center" },
      );
    doc.fillColor("#000000");

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
