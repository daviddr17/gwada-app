import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyAccountingListSort,
  DEFAULT_ACCOUNTING_LIST_SORT_DIR,
  DEFAULT_ACCOUNTING_SALES_DOCUMENT_SORT,
  parseAccountingListSortDir,
  salesDocumentSortColumn,
  type AccountingListSortDir,
} from "@/lib/accounting/accounting-list-sort";
import {
  clampListPage,
  clampListPageSize,
  listPageRange,
  parseListPageParam,
  totalPagesFromCount,
  type PaginatedListResult,
} from "@/lib/constants/list-pagination";

export type AccountingListQueryOptions = {
  source?: string | null;
  search?: string | null;
  status?: string | null;
  documentVariant?: string | null;
  voucherKind?: string | null;
  page?: number | null;
  pageSize?: number | null;
  sort?: string | null;
  sortDir?: string | null;
  /** Resolved by list server — Supabase order column */
  sortColumn?: string;
  /** Resolved by list server */
  resolvedSortDir?: AccountingListSortDir;
};

function escapeIlikeTerm(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '""')
    .replace(/,/g, " ")
    .trim();
}

function ilikePattern(term: string): string {
  return `%${escapeIlikeTerm(term)}%`;
}

export function applyAccountingSourceFilter<
  T extends { eq: (column: string, value: string) => T },
>(query: T, source?: string | null): T {
  if (source && source !== "all") {
    return query.eq("source", source);
  }
  return query;
}

export function applyAccountingStatusFilter<
  T extends { eq: (column: string, value: string) => T },
>(query: T, status?: string | null): T {
  if (status && status !== "all") {
    return query.eq("status", status);
  }
  return query;
}

export function applyAccountingDocumentVariantFilter<
  T extends { eq: (column: string, value: string) => T },
>(query: T, variant?: string | null): T {
  if (variant && variant !== "all") {
    return query.eq("document_variant", variant);
  }
  return query;
}

export function applyAccountingVoucherKindFilter<
  T extends { eq: (column: string, value: string) => T },
>(query: T, kind?: string | null): T {
  if (kind && kind !== "all") {
    return query.eq("voucher_kind", kind);
  }
  return query;
}

export function applyAccountingSalesDocumentSearch<
  T extends { or: (filters: string) => T },
>(query: T, search?: string | null): T {
  const term = search?.trim();
  if (!term) return query;
  const pattern = ilikePattern(term);
  return query.or(
    `voucher_number.ilike."${pattern}",recipient_snapshot->>name.ilike."${pattern}"`,
  );
}

export function applyAccountingVoucherSearch<
  T extends { or: (filters: string) => T },
>(query: T, search?: string | null): T {
  const term = search?.trim();
  if (!term) return query;
  const pattern = ilikePattern(term);
  return query.or(
    `voucher_number.ilike."${pattern}",contact_name.ilike."${pattern}"`,
  );
}

export async function fetchAccountingPaginatedList<T>(params: {
  sb: SupabaseClient;
  table: "accounting_invoices" | "accounting_quotations" | "accounting_vouchers";
  restaurantId: string;
  options?: AccountingListQueryOptions;
  applySearch: <Q extends { or: (filters: string) => Q }>(query: Q, search?: string | null) => Q;
  mapRow: (row: Record<string, unknown>) => T;
}): Promise<PaginatedListResult<T>> {
  const pageSize = clampListPageSize(params.options?.pageSize ?? null);
  const requestedPage = parseListPageParam(
    params.options?.page != null ? String(params.options.page) : "1",
  );
  const search = params.options?.search ?? null;
  const source = params.options?.source ?? null;
  const status = params.options?.status ?? null;
  const documentVariant = params.options?.documentVariant ?? null;
  const voucherKind = params.options?.voucherKind ?? null;
  const sortColumn =
    params.options?.sortColumn ??
    salesDocumentSortColumn(DEFAULT_ACCOUNTING_SALES_DOCUMENT_SORT);
  const sortDir =
    params.options?.resolvedSortDir ??
    parseAccountingListSortDir(params.options?.sortDir ?? null) ??
    DEFAULT_ACCOUNTING_LIST_SORT_DIR;

  const buildQuery = (page: number) => {
    const { from, to } = listPageRange(page, pageSize);
    let query = params.sb
      .from(params.table)
      .select("*", { count: "exact" })
      .eq("restaurant_id", params.restaurantId)
      .range(from, to);

    query = applyAccountingListSort(query, sortColumn, sortDir);

    query = applyAccountingSourceFilter(query, source);
    query = applyAccountingStatusFilter(query, status);
    if (
      params.table === "accounting_invoices" ||
      params.table === "accounting_vouchers"
    ) {
      query = applyAccountingDocumentVariantFilter(query, documentVariant);
    }
    if (params.table === "accounting_vouchers") {
      query = applyAccountingVoucherKindFilter(query, voucherKind);
    }
    query = params.applySearch(query, search);
    return query;
  };

  let page = requestedPage;
  let { data, error, count } = await buildQuery(page);

  const totalCount = count ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  page = clampListPage(page, totalPages);

  if (page !== requestedPage) {
    ({ data, error, count } = await buildQuery(page));
  }

  if (error) {
    console.warn(`fetchAccountingPaginatedList ${params.table}`, error.message);
    return {
      items: [],
      page: 1,
      pageSize,
      totalCount: 0,
      totalPages: 1,
    };
  }

  return {
    items: (data ?? []).map((row) =>
      params.mapRow(row as Record<string, unknown>),
    ),
    page,
    pageSize,
    totalCount: count ?? totalCount,
    totalPages,
  };
}

export function parseAccountingListQueryFromUrl(url: URL): AccountingListQueryOptions {
  return {
    source: url.searchParams.get("source") ?? url.searchParams.get("platform"),
    search: url.searchParams.get("q"),
    status: url.searchParams.get("status"),
    documentVariant: url.searchParams.get("variant"),
    voucherKind: url.searchParams.get("kind"),
    page: parseListPageParam(url.searchParams.get("page")),
    pageSize: clampListPageSize(
      url.searchParams.get("pageSize")
        ? Number.parseInt(url.searchParams.get("pageSize") ?? "", 10)
        : null,
    ),
    sort: url.searchParams.get("sort"),
    sortDir: url.searchParams.get("dir"),
  };
}
