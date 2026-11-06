import "server-only";

import { loadPDFDocument } from "@/lib/pos/load-pdf-document";

export type BillingInvoicePdfInput = {
  number: string;
  restaurantName: string;
  status: string;
  billingReason: string | null;
  currency: string;
  amountDueCents: number;
  amountPaidCents: number;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
  molliePaymentId: string | null;
};

function fmtEurFromCents(cents: number, currency: string): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  return `${euros} ${(currency || "eur").toUpperCase()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(ms));
}

export async function buildBillingInvoicePdf(
  input: BillingInvoicePdfInput,
): Promise<Buffer> {
  const PDFDocument = loadPDFDocument();
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(20).text("Gwada — Abo-Rechnung", { continued: false });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#444").text(`Beleg ${input.number}`);
  doc.moveDown(1);

  doc.fillColor("#000").fontSize(12);
  doc.text(`Restaurant: ${input.restaurantName}`);
  doc.text(`Status: ${input.status}`);
  if (input.billingReason) {
    doc.text(`Grund: ${input.billingReason.replaceAll("_", " ")}`);
  }
  doc.text(`Datum: ${fmtDate(input.paidAt ?? input.createdAt)}`);
  if (input.periodStart || input.periodEnd) {
    doc.text(
      `Zeitraum: ${fmtDate(input.periodStart)} – ${fmtDate(input.periodEnd)}`,
    );
  }
  if (input.molliePaymentId) {
    doc.text(`Mollie-Zahlung: ${input.molliePaymentId}`);
  }

  doc.moveDown(1.5);
  doc.fontSize(14).text("Betrag");
  doc.moveDown(0.4);
  doc.fontSize(12);
  doc.text(
    `Fällig: ${fmtEurFromCents(input.amountDueCents, input.currency)}`,
  );
  doc.text(
    `Bezahlt: ${fmtEurFromCents(input.amountPaidCents, input.currency)}`,
  );

  doc.moveDown(2);
  doc.fontSize(9).fillColor("#666").text(
    "Dies ist ein Beleg für das Gwada-Software-Abonnement (SaaS). Keine Gast-Rechnung aus der Restaurant-Buchführung.",
    { width: 480 },
  );

  doc.end();
  return done;
}
