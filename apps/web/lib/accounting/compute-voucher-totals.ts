import { randomUUID } from "crypto";
import type { AccountingVoucherItem } from "@/lib/types/accounting";

export function reindexVoucherItems(
  items: AccountingVoucherItem[],
): AccountingVoucherItem[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

export function computeVoucherItemTaxAmount(
  amount: number,
  taxRatePercent: number,
  taxMode: "net" | "gross",
): number {
  if (taxRatePercent <= 0) return 0;
  if (taxMode === "gross") {
    return Math.round((amount - amount / (1 + taxRatePercent / 100)) * 100) / 100;
  }
  return Math.round(amount * (taxRatePercent / 100) * 100) / 100;
}

export function normalizeVoucherItems(
  items: AccountingVoucherItem[],
  taxMode: "net" | "gross",
): AccountingVoucherItem[] {
  return reindexVoucherItems(
    items.map((item) => {
      const amount = Number(item.amount) || 0;
      const taxRatePercent = Number(item.taxRatePercent) || 0;
      const taxAmount = computeVoucherItemTaxAmount(
        amount,
        taxRatePercent,
        taxMode,
      );
      return {
        ...item,
        id: item.id || randomUUID(),
        amount,
        taxRatePercent,
        taxAmount,
        label: item.label?.trim() || "Position",
        categoryLabel: item.categoryLabel?.trim() || null,
      };
    }),
  );
}

export function computeVoucherTotals(
  items: AccountingVoucherItem[],
  taxMode: "net" | "gross",
): { totalGross: number; totalTax: number } {
  let totalGross = 0;
  let totalTax = 0;
  for (const item of items) {
    const amount = Number(item.amount) || 0;
    const taxAmount = Number(item.taxAmount) || 0;
    if (taxMode === "gross") {
      totalGross += amount;
      totalTax += taxAmount;
    } else {
      totalGross += amount + taxAmount;
      totalTax += taxAmount;
    }
  }
  return {
    totalGross: Math.round(totalGross * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
  };
}
