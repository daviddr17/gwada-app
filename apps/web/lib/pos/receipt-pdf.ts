import "server-only";

import { formatCentsAsDecimal } from "@gwada/shared";
import { splitItemVatCents } from "@gwada/pos-domain";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit") as typeof import("pdfkit");

export type ReceiptOrderInput = {
  id: string;
  createdAt: Date;
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
  items: Array<{
    quantity: number;
    name: string;
    unitPriceCents: number;
    lineTotalCents: number;
    vatRate: number;
  }>;
  payments: Array<{
    method: string;
    amountCents: number;
    receivedAmountCents: number | null;
  }>;
  tableLabel: string;
  staffName: string | null;
};

export type ReceiptRestaurantInput = {
  name: string;
  areaName: string | null;
  addressLine: string | null;
  phone: string | null;
  vatNumber: string | null;
  receiptFooter: string | null;
  website: string | null;
  socialHandle: string | null;
};

export type ReceiptFiskalyInput = {
  txId: string;
  signature: string;
  signatureCounter: number;
  signedAt: Date | null;
  tssId: string;
  clientId: string;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Bar",
  card: "Karte",
  paypal: "PayPal",
};

function fmtCents(cents: number): string {
  return formatCentsAsDecimal(cents).replace(".", ",");
}

function buildVatLetterMap(
  items: ReceiptOrderInput["items"],
): Map<number, string> {
  const letters = ["A", "B", "C", "D"];
  const map = new Map<number, string>();
  let idx = 0;
  for (const item of items) {
    if (!map.has(item.vatRate)) {
      map.set(item.vatRate, letters[idx] ?? String(idx + 1));
      idx++;
    }
  }
  return map;
}

function buildVatBreakdown(
  items: ReceiptOrderInput["items"],
  vatLetters: Map<number, string>,
): string[] {
  const byRate = new Map<number, number>();
  for (const item of items) {
    byRate.set(
      item.vatRate,
      (byRate.get(item.vatRate) ?? 0) + item.lineTotalCents,
    );
  }

  const lines: string[] = [];
  for (const [rate, inclCents] of byRate.entries()) {
    const { netCents, vatCents } = splitItemVatCents(inclCents, rate);
    const letter = vatLetters.get(rate) ?? "?";
    lines.push(
      `${letter}: MwSt. ${rate}% auf ${fmtCents(netCents)}: € ${fmtCents(vatCents)} (${fmtCents(inclCents)})`,
    );
  }
  return lines;
}

function calcPreTaxCents(items: ReceiptOrderInput["items"]): number {
  let total = 0;
  for (const item of items) {
    total += splitItemVatCents(item.lineTotalCents, item.vatRate).netCents;
  }
  return total;
}

function buildLines(
  order: ReceiptOrderInput,
  fiskalyTx: ReceiptFiskalyInput | null,
  restaurant: ReceiptRestaurantInput,
  COLS: number,
): string[] {
  const SEP = "=".repeat(COLS);
  const sep = "-".repeat(COLS);

  const c = (s: string): string => {
    const pad = Math.max(0, Math.floor((COLS - s.length) / 2));
    return " ".repeat(pad) + s;
  };

  const rl = (label: string, value: string): string => {
    const spaces = Math.max(1, COLS - label.length - value.length);
    return label + " ".repeat(spaces) + value;
  };

  const wrap = (s: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < s.length; i += COLS) out.push(s.slice(i, i + COLS));
    return out;
  };

  const lines: string[] = [];

  lines.push(c(restaurant.name));
  if (restaurant.areaName) {
    lines.push(c(restaurant.areaName));
  }
  lines.push("");

  const dateStr = order.createdAt.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "medium",
  });
  lines.push(rl(`Quittung ${order.id.slice(0, 8)}`, dateStr));
  lines.push(SEP);
  lines.push(c(order.tableLabel));

  if (order.staffName) {
    lines.push(rl("Bedienung:", order.staffName));
  }

  lines.push("");

  const vatLetters = buildVatLetterMap(order.items);
  const NAME_COL = 24;

  for (const item of order.items) {
    const letter = vatLetters.get(item.vatRate) ?? "";
    const qtyName = `${item.quantity} ${item.name}`;
    const left =
      qtyName.length <= NAME_COL
        ? qtyName.padEnd(NAME_COL)
        : qtyName.slice(0, NAME_COL);
    lines.push(
      `${left}${fmtCents(item.unitPriceCents)}  ${fmtCents(item.lineTotalCents)} ${letter}`,
    );
  }

  lines.push(sep);

  const slotSubtotal = order.items.reduce(
    (sum, i) => sum + i.lineTotalCents,
    0,
  );
  lines.push(rl("Summe", `€ ${fmtCents(slotSubtotal)}`));
  lines.push(c(`(Vor Steuern: € ${fmtCents(calcPreTaxCents(order.items))})`));

  if (order.tipCents > 0) {
    lines.push(rl("Trinkgeld", `€ ${fmtCents(order.tipCents)}`));
    lines.push(rl("Gesamt", `€ ${fmtCents(slotSubtotal + order.tipCents)}`));
  }

  lines.push("");

  const paymentsTotal = order.payments.reduce(
    (sum, p) => sum + p.amountCents,
    0,
  );

  for (const payment of order.payments) {
    const label = PAYMENT_METHOD_LABELS[payment.method] ?? payment.method;
    lines.push(rl(label, `€ ${fmtCents(payment.amountCents)}`));

    if (payment.method === "cash" && payment.receivedAmountCents != null) {
      const change =
        payment.receivedAmountCents - paymentsTotal - order.tipCents;
      lines.push(rl("Gegeben", `€ ${fmtCents(payment.receivedAmountCents)}`));
      if (change > 0) {
        lines.push(rl("Rückgeld", `€ ${fmtCents(change)}`));
      }
    }
  }
  lines.push("");

  for (const vl of buildVatBreakdown(order.items, vatLetters)) {
    lines.push(vl);
  }
  lines.push("");

  if (restaurant.vatNumber) {
    lines.push(`MwSt.-Nummer:${restaurant.vatNumber}`);
  }
  if (restaurant.phone) lines.push(restaurant.phone);
  if (restaurant.receiptFooter) lines.push(c(restaurant.receiptFooter));
  if (restaurant.website) lines.push(c(restaurant.website));
  if (restaurant.socialHandle) lines.push(c(restaurant.socialHandle));
  lines.push(c(restaurant.name));
  if (restaurant.addressLine) lines.push(c(restaurant.addressLine));

  if (fiskalyTx) {
    lines.push(sep);
    lines.push(c("TSE Informationen"));

    const tseLine = (label: string, value: string): void => {
      if (label.length + value.length <= COLS) {
        lines.push(rl(label, value));
      } else {
        const avail = COLS - label.length;
        lines.push(label + value.slice(0, avail));
        for (const chunk of wrap(value.slice(avail))) lines.push(chunk);
      }
    };

    tseLine("TSE-Transaktion:", fiskalyTx.txId);
    tseLine("TSE-Signatur-Nr.:", String(fiskalyTx.signatureCounter));
    tseLine(
      "TSE-ErsteBestellung:".padEnd(21),
      order.createdAt.toISOString(),
    );
    tseLine("TSE-Start:".padEnd(21), order.createdAt.toISOString());
    tseLine(
      "TSE-Stop:".padEnd(21),
      fiskalyTx.signedAt?.toISOString() ?? "-",
    );
    tseLine("TSE-Signatur:", fiskalyTx.signature);
    tseLine("Kasse-Seriennummer:", fiskalyTx.clientId);
    tseLine("TSS-ID:", fiskalyTx.tssId);
  }

  return lines;
}

export function buildPosReceiptPdfBuffer(
  order: ReceiptOrderInput,
  fiskalyTx: ReceiptFiskalyInput | null,
  restaurant: ReceiptRestaurantInput,
): Promise<Buffer> {
  const PAGE_W = 175.75;
  const M = 6;
  const W = PAGE_W - M * 2;
  const FONT_SZ = 6.5;
  const CHAR_W = FONT_SZ * 0.6;
  const COLS = Math.floor(W / CHAR_W);
  const LINE_H = FONT_SZ * 1.4;

  const contentLines = buildLines(order, fiskalyTx, restaurant, COLS);
  const pageHeight = M + contentLines.length * LINE_H + M;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_W, pageHeight],
      margin: 0,
      info: { Title: `Quittung ${order.id.slice(0, 8)}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(FONT_SZ).font("Courier");
    let y = M;
    for (const line of contentLines) {
      doc.text(line, M, y, { lineBreak: false, width: W });
      y += LINE_H;
    }

    doc.end();
  });
}
