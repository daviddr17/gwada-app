import "server-only";

import { formatCentsAsDecimal } from "@gwada/shared";
import { splitItemVatCents } from "@gwada/pos-domain";
import type { RegisterSessionAggregate } from "@/lib/pos/register-report-aggregate";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit") as typeof import("pdfkit");

export type RegisterReportPdfInput = {
  reportType: "X" | "Z";
  restaurantName: string;
  aggregate: RegisterSessionAggregate;
};

function fmtCents(cents: number): string {
  return formatCentsAsDecimal(cents).replace(".", ",");
}

function formatBerlinDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function buildRegisterReportPdfBuffer(
  input: RegisterReportPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [226.77, 600],
      margins: { top: 12, bottom: 12, left: 10, right: 10 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const COLS = 32;
    const title =
      input.reportType === "X" ? "X-BERICHT (Zwischenstand)" : "Z-BERICHT";

    const center = (s: string) => {
      doc.fontSize(9).text(s, { align: "center", width: COLS * 6 });
    };

    const row = (label: string, value: string) => {
      doc.fontSize(8).text(`${label}: ${value}`, { width: COLS * 6 });
    };

    center(input.restaurantName);
    doc.moveDown(0.3);
    center(title);
    doc.moveDown(0.5);

    row("Geöffnet", formatBerlinDateTime(input.aggregate.openedAt));
    if (input.aggregate.closedAt) {
      row("Geschlossen", formatBerlinDateTime(input.aggregate.closedAt));
    }
    if (input.aggregate.zNr != null) {
      row("Z-Nr.", String(input.aggregate.zNr));
    }

    doc.moveDown(0.4);
    doc.fontSize(8).text("—".repeat(COLS));
    doc.moveDown(0.3);

    row("Anfangsbestand", `€ ${fmtCents(input.aggregate.openingCashCents)}`);
    if (input.aggregate.expectedCashCents != null) {
      row("Soll Bar", `€ ${fmtCents(input.aggregate.expectedCashCents)}`);
    }
    if (input.aggregate.closingCashCents != null) {
      row("Ist Bar (gezählt)", `€ ${fmtCents(input.aggregate.closingCashCents)}`);
    }
    if (input.aggregate.cashDifferenceCents != null) {
      row("Differenz", `€ ${fmtCents(input.aggregate.cashDifferenceCents)}`);
    }

    doc.moveDown(0.4);
    row("Belege (TSE)", String(input.aggregate.transactionCount));
    row("Umsatz gesamt", `€ ${fmtCents(input.aggregate.totalSalesCents)}`);
    row("Barzahlungen", `€ ${fmtCents(input.aggregate.cashPaymentsCents)}`);
    if (input.aggregate.totalNonCashSalesCents > 0) {
      row("davon Unbar", `€ ${fmtCents(input.aggregate.totalNonCashSalesCents)}`);
    }

    if (input.aggregate.paymentTypeTotals.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(8).text("Zahlungsarten:");
      for (const pt of input.aggregate.paymentTypeTotals) {
        doc.fontSize(8).text(`  ${pt.type}: € ${fmtCents(pt.amountCents)}`);
      }
    }

    if (input.aggregate.vatByRate.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(8).text("MwSt:");
      for (const vat of input.aggregate.vatByRate) {
        const { netCents, vatCents } = splitItemVatCents(
          vat.grossCents,
          vat.rate,
        );
        doc
          .fontSize(8)
          .text(
            `  ${vat.rate}%: Netto € ${fmtCents(netCents)}, MwSt € ${fmtCents(vatCents)}`,
          );
      }
    }

    doc.moveDown(0.5);
    center(
      input.reportType === "X"
        ? "Kasse bleibt geöffnet"
        : "Kassenabschluss abgeschlossen",
    );

    doc.end();
  });
}
