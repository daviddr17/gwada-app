import type { AccountingLineItem } from "@/lib/types/accounting";

export const DEFAULT_ACCOUNTING_TAX_RATES = [
  { label: "0 %", rate_percent: 0, is_default: false, sort_order: 0 },
  { label: "7 %", rate_percent: 7, is_default: false, sort_order: 1 },
  { label: "19 %", rate_percent: 19, is_default: true, sort_order: 2 },
] as const;

export const DEFAULT_ACCOUNTING_UNITS = [
  "Stück",
  "Stunde",
  "Pauschal",
  "kg",
  "l",
] as const;

export function createEmptyLineItem(
  defaults: { unitName?: string; taxRatePercent?: number } = {},
): AccountingLineItem {
  return {
    id: crypto.randomUUID(),
    sortOrder: 0,
    type: "custom",
    articleId: null,
    name: "",
    description: null,
    quantity: 1,
    unitName: defaults.unitName ?? "Stück",
    unitPrice: 0,
    taxRatePercent: defaults.taxRatePercent ?? 0,
    discountPercent: 0,
    lineAmount: 0,
  };
}
