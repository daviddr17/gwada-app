import type { AccountingVoucherKind } from "@/lib/types/accounting";
import {
  ACCOUNTING_FILTER_ALL,
  type AccountingPlatformFilter,
  parseAccountingPlatformFilter,
} from "@/lib/constants/accounting-platforms";

export type AccountingDocumentVariantFilter =
  | typeof ACCOUNTING_FILTER_ALL
  | "standard"
  | "correction";

export type AccountingVoucherKindFilter =
  | typeof ACCOUNTING_FILTER_ALL
  | AccountingVoucherKind;

export const ACCOUNTING_VARIANT_FILTER_LABELS: Record<
  AccountingDocumentVariantFilter,
  string
> = {
  all: "Alle Typen",
  standard: "Standard",
  correction: "Korrektur / Gutschrift",
};

export const ACCOUNTING_VOUCHER_KIND_FILTER_LABELS: Record<
  AccountingVoucherKindFilter,
  string
> = {
  all: "Alle Belegarten",
  expense: "Ausgabe",
  purchase: "Einkauf",
  income: "Einnahme",
  sales: "Verkauf",
};

const VOUCHER_KINDS = ["expense", "purchase", "income", "sales"] as const;

export function parseAccountingStatusFilter(
  param: string | null,
): string {
  const trimmed = param?.trim();
  return trimmed ? trimmed : ACCOUNTING_FILTER_ALL;
}

export function parseAccountingDocumentVariantFilter(
  param: string | null,
): AccountingDocumentVariantFilter {
  if (param === "standard" || param === "correction") return param;
  return ACCOUNTING_FILTER_ALL;
}

export function parseAccountingVoucherKindFilter(
  param: string | null,
): AccountingVoucherKindFilter {
  if (
    param &&
    (VOUCHER_KINDS as readonly string[]).includes(param)
  ) {
    return param as AccountingVoucherKind;
  }
  return ACCOUNTING_FILTER_ALL;
}

export function countAccountingListActiveFilters(input: {
  platformFilter: AccountingPlatformFilter;
  statusFilter: string;
  variantFilter?: AccountingDocumentVariantFilter;
  voucherKindFilter?: AccountingVoucherKindFilter;
}): number {
  let count = 0;
  if (input.platformFilter !== ACCOUNTING_FILTER_ALL) count += 1;
  if (input.statusFilter !== ACCOUNTING_FILTER_ALL) count += 1;
  if (input.variantFilter && input.variantFilter !== ACCOUNTING_FILTER_ALL) {
    count += 1;
  }
  if (
    input.voucherKindFilter &&
    input.voucherKindFilter !== ACCOUNTING_FILTER_ALL
  ) {
    count += 1;
  }
  return count;
}

export { ACCOUNTING_FILTER_ALL, parseAccountingPlatformFilter };
