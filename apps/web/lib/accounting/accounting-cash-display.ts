import type { AccountingCashEntryTaxLine } from "@/lib/types/accounting-cash-book";
import { computeVoucherItemTaxAmount } from "@/lib/accounting/compute-voucher-totals";

export function formatCashTaxRatesSummary(
  lines: AccountingCashEntryTaxLine[] | null | undefined,
): string {
  if (!lines?.length) return "—";
  const rates = [
    ...new Set(
      lines
        .map((line) => line.taxRatePercent)
        .filter((rate) => Number.isFinite(rate) && rate > 0),
    ),
  ].sort((a, b) => b - a);

  if (!rates.length) return "0 %";
  if (rates.length === 1) return `${rates[0]} %`;
  return rates.map((rate) => `${rate} %`).join(", ");
}

export function normalizeCashEntryTaxLines(
  lines: Array<{ id?: string; amount: number; tax_rate_percent: number }>,
): Array<{
  id?: string;
  amount: number;
  tax_rate_percent: number;
  tax_amount: number;
}> {
  return lines
    .map((line, index) => {
      const amount = Number(line.amount) || 0;
      const tax_rate_percent = Number(line.tax_rate_percent) || 0;
      if (amount <= 0) return null;
      return {
        id: line.id,
        amount,
        tax_rate_percent,
        tax_amount: computeVoucherItemTaxAmount(
          amount,
          tax_rate_percent,
          "gross",
        ),
        sort_order: index,
      };
    })
    .filter(Boolean) as Array<{
    id?: string;
    amount: number;
    tax_rate_percent: number;
    tax_amount: number;
    sort_order: number;
  }>;
}

export function cashEntryTaxLinesFromDb(
  rows: Array<{
    id: string;
    sort_order: number;
    amount: unknown;
    tax_rate_percent: unknown;
    tax_amount: unknown;
  }>,
): AccountingCashEntryTaxLine[] {
  return rows
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      id: row.id,
      sortOrder: row.sort_order,
      amount: Number(row.amount) || 0,
      taxRatePercent: Number(row.tax_rate_percent) || 0,
      taxAmount: Number(row.tax_amount) || 0,
    }));
}

export function cashEntryTotalGross(
  lines: AccountingCashEntryTaxLine[] | null | undefined,
): number {
  if (!lines?.length) return 0;
  return Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
}

export function voucherLabelForPicker(row: {
  voucher_number: string | null;
  contact_name: string | null;
  voucher_date: string;
  total_gross_amount: number;
}): string {
  const number = row.voucher_number?.trim() || "Ohne Nummer";
  const contact = row.contact_name?.trim();
  const date = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${row.voucher_date}T12:00:00`));
  const amount = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(row.total_gross_amount);
  return contact
    ? `${number} · ${contact} · ${date} · ${amount}`
    : `${number} · ${date} · ${amount}`;
}
