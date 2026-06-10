export type AccountingListSortDir = "asc" | "desc";

export const ACCOUNTING_SALES_DOCUMENT_SORT_KEYS = [
  "voucher_number",
  "voucher_date",
  "recipient",
  "amount",
  "status",
  "source",
] as const;

export type AccountingSalesDocumentSortKey =
  (typeof ACCOUNTING_SALES_DOCUMENT_SORT_KEYS)[number];

export const ACCOUNTING_VOUCHER_SORT_KEYS = [
  "voucher_number",
  "voucher_date",
  "contact_name",
  "voucher_kind",
  "amount",
  "status",
  "source",
] as const;

export type AccountingVoucherSortKey =
  (typeof ACCOUNTING_VOUCHER_SORT_KEYS)[number];

export const DEFAULT_ACCOUNTING_SALES_DOCUMENT_SORT: AccountingSalesDocumentSortKey =
  "voucher_date";

export const DEFAULT_ACCOUNTING_VOUCHER_SORT: AccountingVoucherSortKey =
  "voucher_date";

export const DEFAULT_ACCOUNTING_LIST_SORT_DIR: AccountingListSortDir = "desc";

export function parseAccountingListSortDir(
  raw: string | null | undefined,
): AccountingListSortDir {
  return raw === "asc" ? "asc" : "desc";
}

export function parseSalesDocumentSortKey(
  raw: string | null | undefined,
): AccountingSalesDocumentSortKey {
  if (
    raw &&
    (ACCOUNTING_SALES_DOCUMENT_SORT_KEYS as readonly string[]).includes(raw)
  ) {
    return raw as AccountingSalesDocumentSortKey;
  }
  return DEFAULT_ACCOUNTING_SALES_DOCUMENT_SORT;
}

export function parseVoucherSortKey(
  raw: string | null | undefined,
): AccountingVoucherSortKey {
  if (raw && (ACCOUNTING_VOUCHER_SORT_KEYS as readonly string[]).includes(raw)) {
    return raw as AccountingVoucherSortKey;
  }
  return DEFAULT_ACCOUNTING_VOUCHER_SORT;
}

export function salesDocumentSortColumn(key: AccountingSalesDocumentSortKey): string {
  switch (key) {
    case "recipient":
      return "recipient_snapshot->>name";
    case "amount":
      return "totals->totalGross";
    default:
      return key;
  }
}

export function voucherSortColumn(key: AccountingVoucherSortKey): string {
  if (key === "amount") return "total_gross_amount";
  return key;
}

export function applyAccountingListSort<
  T extends { order: (column: string, options?: { ascending?: boolean }) => T },
>(query: T, column: string, dir: AccountingListSortDir): T {
  const ascending = dir === "asc";
  if (column === "created_at") {
    return query.order("created_at", { ascending });
  }
  return query
    .order(column, { ascending })
    .order("created_at", { ascending: false });
}

export function isDefaultSalesDocumentSort(
  sort: AccountingSalesDocumentSortKey,
  dir: AccountingListSortDir,
): boolean {
  return (
    sort === DEFAULT_ACCOUNTING_SALES_DOCUMENT_SORT &&
    dir === DEFAULT_ACCOUNTING_LIST_SORT_DIR
  );
}

export function isDefaultVoucherSort(
  sort: AccountingVoucherSortKey,
  dir: AccountingListSortDir,
): boolean {
  return (
    sort === DEFAULT_ACCOUNTING_VOUCHER_SORT &&
    dir === DEFAULT_ACCOUNTING_LIST_SORT_DIR
  );
}
