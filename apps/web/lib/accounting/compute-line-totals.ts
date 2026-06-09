import type {
  AccountingLineItem,
  AccountingTaxMode,
  AccountingTotals,
} from "@/lib/types/accounting";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeLineAmount(
  item: Pick<
    AccountingLineItem,
    "quantity" | "unitPrice" | "discountPercent" | "taxRatePercent"
  >,
  taxMode: AccountingTaxMode,
): number {
  const base = item.quantity * item.unitPrice;
  const discounted = base * (1 - (item.discountPercent || 0) / 100);
  if (taxMode === "gross") {
    return roundMoney(discounted);
  }
  const tax = discounted * (item.taxRatePercent / 100);
  return roundMoney(discounted + tax);
}

export function computeDocumentTotals(
  lineItems: AccountingLineItem[],
  taxMode: AccountingTaxMode,
  currency: string,
): AccountingTotals {
  let totalNet = 0;
  let totalTax = 0;

  for (const item of lineItems) {
    if (item.type === "text") continue;
    const base = item.quantity * item.unitPrice;
    const discounted = base * (1 - (item.discountPercent || 0) / 100);
    if (taxMode === "gross") {
      const gross = discounted;
      const net = gross / (1 + item.taxRatePercent / 100);
      totalNet += net;
      totalTax += gross - net;
    } else if (taxMode === "vatfree") {
      totalNet += discounted;
    } else {
      const tax = discounted * (item.taxRatePercent / 100);
      totalNet += discounted;
      totalTax += tax;
    }
  }

  return {
    currency,
    totalNet: roundMoney(totalNet),
    totalTax: roundMoney(totalTax),
    totalGross: roundMoney(totalNet + totalTax),
  };
}

export function reindexLineItems(
  items: AccountingLineItem[],
): AccountingLineItem[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}
