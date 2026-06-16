import type { PaginatedListResult } from "@/lib/constants/list-pagination";
import type {
  AccountingCashBookListResult,
  AccountingCashBookSettingsRow,
  AccountingCashCategoryRow,
  AccountingCashDirection,
  AccountingCashEntryInput,
  AccountingCashEntryRow,
} from "@/lib/types/accounting-cash-book";
import type {
  AccountingArticleRow,
  AccountingDocumentKind,
  AccountingDocumentStatusRow,
  AccountingInvoiceRow,
  AccountingQuotationRow,
  AccountingSalesDocumentInput,
  AccountingTaxRateRow,
  AccountingUnitRow,
} from "@/lib/types/accounting";

export async function fetchAccountingCatalog(restaurantId: string): Promise<{
  taxRates: AccountingTaxRateRow[];
  units: AccountingUnitRow[];
  articles: AccountingArticleRow[];
}> {
  const res = await fetch(
    `/api/accounting/catalog?restaurantId=${encodeURIComponent(restaurantId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("catalog_load_failed");
  return res.json();
}

export type AccountingListFetchParams = {
  source?: string;
  status?: string;
  documentVariant?: string;
  voucherKind?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  sortDir?: string;
};

function accountingListSearchParams(
  restaurantId: string,
  params?: AccountingListFetchParams,
): URLSearchParams {
  const qs = new URLSearchParams({ restaurantId });
  if (params?.source && params.source !== "all") qs.set("source", params.source);
  if (params?.status && params.status !== "all") qs.set("status", params.status);
  if (params?.documentVariant && params.documentVariant !== "all") {
    qs.set("variant", params.documentVariant);
  }
  if (params?.voucherKind && params.voucherKind !== "all") {
    qs.set("kind", params.voucherKind);
  }
  if (params?.search?.trim()) qs.set("q", params.search.trim());
  if (params?.page && params.page > 1) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.sortDir) qs.set("dir", params.sortDir);
  return qs;
}

export async function fetchAccountingInvoices(
  restaurantId: string,
  params?: AccountingListFetchParams,
): Promise<PaginatedListResult<AccountingInvoiceRow>> {
  const qs = accountingListSearchParams(restaurantId, params);
  const res = await fetch(`/api/accounting/invoices?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("invoices_load_failed");
  const data = (await res.json()) as {
    invoices: AccountingInvoiceRow[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  return {
    items: data.invoices,
    page: data.page,
    pageSize: data.pageSize,
    totalCount: data.totalCount,
    totalPages: data.totalPages,
  };
}

export async function enrichAccountingInvoice(
  restaurantId: string,
  invoiceId: string,
): Promise<AccountingInvoiceRow> {
  const qs = new URLSearchParams({
    restaurantId,
    enrich: "1",
  });
  const res = await fetch(`/api/accounting/invoices/${invoiceId}?${qs}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "enrich_failed");
  return data.invoice as AccountingInvoiceRow;
}

export async function createAccountingInvoice(
  restaurantId: string,
  input: AccountingSalesDocumentInput & { restaurantId?: string },
): Promise<AccountingInvoiceRow> {
  const res = await fetch("/api/accounting/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "create_failed");
  return data.invoice as AccountingInvoiceRow;
}

export async function updateAccountingInvoice(
  restaurantId: string,
  invoiceId: string,
  input: Partial<AccountingSalesDocumentInput> & {
    status?: string;
    restaurantId?: string;
  },
): Promise<AccountingInvoiceRow> {
  const res = await fetch(`/api/accounting/invoices/${invoiceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "update_failed");
  return data.invoice as AccountingInvoiceRow;
}

export async function fetchAccountingQuotations(
  restaurantId: string,
  params?: AccountingListFetchParams,
): Promise<PaginatedListResult<AccountingQuotationRow>> {
  const qs = accountingListSearchParams(restaurantId, params);
  const res = await fetch(`/api/accounting/quotations?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("quotations_load_failed");
  const data = (await res.json()) as {
    quotations: AccountingQuotationRow[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  return {
    items: data.quotations,
    page: data.page,
    pageSize: data.pageSize,
    totalCount: data.totalCount,
    totalPages: data.totalPages,
  };
}

export async function createAccountingQuotation(
  restaurantId: string,
  input: AccountingSalesDocumentInput & { restaurantId?: string },
): Promise<AccountingQuotationRow> {
  const res = await fetch("/api/accounting/quotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "create_failed");
  return data.quotation as AccountingQuotationRow;
}

export async function updateAccountingQuotation(
  restaurantId: string,
  quotationId: string,
  input: Partial<AccountingSalesDocumentInput> & {
    status?: string;
    restaurantId?: string;
  },
): Promise<AccountingQuotationRow> {
  const res = await fetch(`/api/accounting/quotations/${quotationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "update_failed");
  return data.quotation as AccountingQuotationRow;
}

export async function fetchAccountingSettings(restaurantId: string) {
  const res = await fetch(
    `/api/accounting/settings?restaurantId=${encodeURIComponent(restaurantId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("settings_load_failed");
  return res.json() as Promise<{ settings: import("@/lib/types/accounting-settings").AccountingSettingsRow }>;
}

export async function fetchAccountingDocumentDesignPreview(
  restaurantId: string,
  documentDesign: import("@/lib/types/accounting-settings").AccountingDocumentDesign,
  kind: "invoice" | "quotation" = "invoice",
): Promise<Blob> {
  const res = await fetch("/api/accounting/settings/preview-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, documentDesign, kind }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "preview_failed");
  }
  return res.blob();
}

export async function saveAccountingSettings(
  restaurantId: string,
  patch: {
    documentFormat?: import("@/lib/types/accounting-settings").AccountingDocumentFormat;
    autoSyncLexoffice?: boolean;
    connectorAutoSync?: {
      connector: import("@/lib/accounting/connectors/connector-meta").AccountingConnectorKey;
      enabled: boolean;
    };
    deductInventoryOnInvoice?: boolean;
    reverseInventoryOnInvoiceCorrection?: boolean;
    documentDesign?: import("@/lib/types/accounting-settings").AccountingDocumentDesign;
    invoiceNumberPrefix?: string;
    invoiceCorrectionNumberPrefix?: string;
    quotationNumberPrefix?: string;
    invoiceNumberIncludeYear?: boolean;
    quotationNumberIncludeYear?: boolean;
    invoiceNumberMinDigits?: number;
    quotationNumberMinDigits?: number;
  },
) {
  const res = await fetch("/api/accounting/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, ...patch }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "settings_save_failed");
  return data.settings as import("@/lib/types/accounting-settings").AccountingSettingsRow;
}

export async function fetchAccountingNextDocumentNumber(
  restaurantId: string,
  kind: "invoice" | "quotation" | "invoice_correction",
  referenceDate?: string | null,
): Promise<string> {
  const qs = new URLSearchParams({
    restaurantId,
    kind,
  });
  if (referenceDate?.trim()) {
    qs.set("referenceDate", referenceDate.trim());
  }
  const res = await fetch(`/api/accounting/sales-documents/next-number?${qs}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as { voucherNumber?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "next_number_failed");
  return data.voucherNumber ?? "";
}

export async function fetchAccountingSalesDocumentDraftPreview(
  restaurantId: string,
  kind: "invoice" | "quotation",
  draft: import("@/lib/accounting/build-sales-document-preview-row").AccountingSalesDocumentDraftPreviewInput,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch("/api/accounting/sales-documents/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, kind, draft }),
    signal,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "preview_failed");
  }
  return res.blob();
}

export async function fetchAccountingConnector(restaurantId: string) {
  const res = await fetch(
    `/api/accounting/connector?${new URLSearchParams({ restaurantId })}`,
    { cache: "no-store" },
  );
  const data = (await res.json()) as {
    connector?: import("@/lib/accounting/connectors/connector-meta").AccountingConnectorPublicInfo;
    error?: string;
  };
  if (!res.ok || !data.connector) {
    throw new Error(data.error ?? "connector_load_failed");
  }
  return data.connector;
}

export async function syncAccountingDocuments(
  restaurantId: string,
  params: {
    scope: "sales" | "vouchers";
    kind?: "invoice" | "quotation";
    force?: boolean;
  },
) {
  const res = await fetch("/api/accounting/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId,
      scope: params.scope,
      kind: params.kind,
      force: params.force === true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "sync_failed");
  return data as {
    imported: number;
    updated: number;
    listed?: number;
    skipped?: boolean;
    rateLimited?: boolean;
  };
}

/** @deprecated Nutze syncAccountingDocuments({ scope: "sales", kind }) */
export async function syncLexofficeSalesDocuments(
  restaurantId: string,
  kind: "invoice" | "quotation",
  opts?: { force?: boolean },
) {
  return syncAccountingDocuments(restaurantId, {
    scope: "sales",
    kind,
    force: opts?.force,
  });
}

export async function fetchAccountingDocumentLog(
  restaurantId: string,
  documentKind: import("@/lib/types/accounting-document-log").AccountingDocumentLogKind,
  documentId: string,
): Promise<import("@/lib/types/accounting-document-log").AccountingDocumentLogEntry[]> {
  const qs = new URLSearchParams({
    restaurantId,
    kind: documentKind,
    documentId,
  });
  const res = await fetch(`/api/accounting/document-log?${qs}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as {
    entries?: import("@/lib/types/accounting-document-log").AccountingDocumentLogEntry[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "document_log_failed");
  return data.entries ?? [];
}

export async function fetchAccountingVouchers(
  restaurantId: string,
  params?: AccountingListFetchParams,
): Promise<PaginatedListResult<import("@/lib/types/accounting").AccountingVoucherRow>> {
  const qs = accountingListSearchParams(restaurantId, params);
  const res = await fetch(`/api/accounting/vouchers?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("vouchers_load_failed");
  const data = (await res.json()) as {
    vouchers: import("@/lib/types/accounting").AccountingVoucherRow[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  return {
    items: data.vouchers,
    page: data.page,
    pageSize: data.pageSize,
    totalCount: data.totalCount,
    totalPages: data.totalPages,
  };
}

export async function fetchAccountingVoucher(
  restaurantId: string,
  voucherId: string,
  opts?: { enrich?: boolean },
): Promise<import("@/lib/types/accounting").AccountingVoucherRow> {
  const qs = new URLSearchParams({ restaurantId });
  if (opts?.enrich) qs.set("enrich", "1");
  const res = await fetch(`/api/accounting/vouchers/${voucherId}?${qs}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as {
    voucher?: import("@/lib/types/accounting").AccountingVoucherRow;
    error?: string;
  };
  if (!res.ok || !data.voucher) {
    throw new Error(data.error ?? "voucher_load_failed");
  }
  return data.voucher;
}

export async function createAccountingVoucher(
  restaurantId: string,
  input: import("@/lib/types/accounting").AccountingVoucherInput,
  file?: File | null,
): Promise<import("@/lib/types/accounting").AccountingVoucherRow> {
  if (file) {
    const form = new FormData();
    form.set("restaurantId", restaurantId);
    form.set("payload", JSON.stringify(input));
    form.set("file", file);
    const res = await fetch("/api/accounting/vouchers", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "create_failed");
    return data.voucher;
  }

  const res = await fetch("/api/accounting/vouchers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "create_failed");
  return data.voucher;
}

export async function updateAccountingVoucher(
  restaurantId: string,
  voucherId: string,
  input: Partial<import("@/lib/types/accounting").AccountingVoucherInput> & {
    status?: string;
  },
): Promise<import("@/lib/types/accounting").AccountingVoucherRow> {
  const res = await fetch(`/api/accounting/vouchers/${voucherId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "update_failed");
  return data.voucher;
}

export async function deleteAccountingVoucher(
  restaurantId: string,
  voucherId: string,
): Promise<void> {
  const params = new URLSearchParams({ restaurantId });
  const res = await fetch(`/api/accounting/vouchers/${voucherId}?${params}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "delete_failed");
}

/** @deprecated Nutze syncAccountingDocuments({ scope: "vouchers" }) */
export async function syncLexofficeVouchers(
  restaurantId: string,
  opts?: { force?: boolean },
) {
  return syncAccountingDocuments(restaurantId, {
    scope: "vouchers",
    force: opts?.force,
  });
}

export function accountingVoucherFileUrl(
  restaurantId: string,
  voucherId: string,
): string {
  return `/api/accounting/vouchers/${voucherId}/file?restaurantId=${encodeURIComponent(restaurantId)}`;
}

export function salesDocumentPdfUrl(
  restaurantId: string,
  kind: "invoice" | "quotation",
  documentId: string,
) {
  const base =
    kind === "invoice"
      ? `/api/accounting/invoices/${documentId}/document`
      : `/api/accounting/quotations/${documentId}/document`;
  return `${base}?restaurantId=${encodeURIComponent(restaurantId)}`;
}

export async function sendSalesDocument(
  restaurantId: string,
  kind: "invoice" | "quotation",
  documentId: string,
  channels: { sendEmail?: boolean; sendWhatsapp?: boolean },
) {
  const base =
    kind === "invoice"
      ? `/api/accounting/invoices/${documentId}/send`
      : `/api/accounting/quotations/${documentId}/send`;
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, ...channels }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "send_failed");
  return data as { channels: string[] };
}

async function catalogJson(
  url: string,
  method: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "catalog_failed");
  return data;
}

export async function saveAccountingTaxRate(
  restaurantId: string,
  payload: {
    id?: string;
    label: string;
    rate_percent: number;
    is_default?: boolean;
    archived?: boolean;
  },
) {
  const method = payload.id ? "PATCH" : "POST";
  return catalogJson("/api/accounting/catalog/tax-rates", method, {
    ...payload,
    restaurantId,
  });
}

export async function reorderAccountingTaxRates(
  restaurantId: string,
  reorder: string[],
) {
  return catalogJson("/api/accounting/catalog/tax-rates", "PATCH", {
    restaurantId,
    reorder,
  });
}

export async function saveAccountingUnit(
  restaurantId: string,
  payload: { id?: string; name: string; archived?: boolean },
) {
  const method = payload.id ? "PATCH" : "POST";
  return catalogJson("/api/accounting/catalog/units", method, {
    ...payload,
    restaurantId,
  });
}

export async function reorderAccountingUnits(
  restaurantId: string,
  reorder: string[],
) {
  return catalogJson("/api/accounting/catalog/units", "PATCH", {
    restaurantId,
    reorder,
  });
}

export async function saveAccountingArticle(
  restaurantId: string,
  payload: {
    id?: string;
    name: string;
    description?: string | null;
    default_unit_name: string;
    default_unit_price: number;
    default_tax_rate_percent: number;
    currency?: string;
    archived?: boolean;
    recipe?: import("@/lib/types/accounting").AccountingArticleRecipeLine[] | null;
  },
) {
  const method = payload.id ? "PATCH" : "POST";
  return catalogJson("/api/accounting/catalog/articles", method, {
    ...payload,
    restaurantId,
  });
}

async function catalogDelete(url: string, restaurantId: string, id: string) {
  const params = new URLSearchParams({ restaurantId, id });
  const res = await fetch(`${url}?${params}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "delete_failed");
}

export async function deleteAccountingTaxRate(restaurantId: string, id: string) {
  return catalogDelete("/api/accounting/catalog/tax-rates", restaurantId, id);
}

export async function deleteAccountingUnit(restaurantId: string, id: string) {
  return catalogDelete("/api/accounting/catalog/units", restaurantId, id);
}

export async function deleteAccountingArticle(restaurantId: string, id: string) {
  return catalogDelete("/api/accounting/catalog/articles", restaurantId, id);
}

export async function fetchAccountingDocumentStatuses(
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  options?: { includeArchived?: boolean },
): Promise<AccountingDocumentStatusRow[]> {
  const qs = new URLSearchParams({
    restaurantId,
    kind: documentKind,
  });
  if (options?.includeArchived) qs.set("includeArchived", "1");
  const res = await fetch(`/api/accounting/catalog/statuses?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("statuses_load_failed");
  const data = (await res.json()) as { statuses: AccountingDocumentStatusRow[] };
  return data.statuses;
}

export async function saveAccountingDocumentStatus(
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  payload: { id?: string; label: string; color_hex?: string; archived?: boolean },
) {
  const method = payload.id ? "PATCH" : "POST";
  return catalogJson("/api/accounting/catalog/statuses", method, {
    ...payload,
    restaurantId,
    document_kind: documentKind,
  });
}

export async function reorderAccountingDocumentStatuses(
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  reorder: string[],
) {
  return catalogJson("/api/accounting/catalog/statuses", "PATCH", {
    restaurantId,
    document_kind: documentKind,
    reorder,
  });
}

export async function deleteAccountingDocumentStatus(
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  id: string,
) {
  const params = new URLSearchParams({ restaurantId, id, kind: documentKind });
  const res = await fetch(`/api/accounting/catalog/statuses?${params}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "delete_failed");
}

// ── Kassenbuch ────────────────────────────────────────────────────────────────

export async function fetchAccountingCashBook(
  restaurantId: string,
  params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    direction?: AccountingCashDirection | "all";
  },
): Promise<AccountingCashBookListResult> {
  const qs = new URLSearchParams({ restaurantId });
  if (params?.page && params.page > 1) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.search?.trim()) qs.set("q", params.search.trim());
  if (params?.direction && params.direction !== "all") {
    qs.set("direction", params.direction);
  }
  const res = await fetch(`/api/accounting/cash-book?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("cash_book_load_failed");
  return res.json();
}

export async function fetchAccountingCashEntry(
  restaurantId: string,
  entryId: string,
): Promise<AccountingCashEntryRow> {
  const qs = new URLSearchParams({ restaurantId });
  const res = await fetch(`/api/accounting/cash-book/${entryId}?${qs}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "cash_entry_load_failed");
  return data.entry as AccountingCashEntryRow;
}

export async function fetchAccountingCashCategories(
  restaurantId: string,
  direction?: AccountingCashDirection,
  options?: { includeArchived?: boolean },
): Promise<AccountingCashCategoryRow[]> {
  const qs = new URLSearchParams({ restaurantId });
  if (direction) qs.set("direction", direction);
  if (options?.includeArchived) qs.set("includeArchived", "1");
  const res = await fetch(`/api/accounting/cash-book/categories?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("cash_categories_load_failed");
  const data = (await res.json()) as { categories: AccountingCashCategoryRow[] };
  return data.categories;
}

export async function saveAccountingCashCategory(
  restaurantId: string,
  payload: {
    id?: string;
    direction: AccountingCashDirection;
    name: string;
    archived?: boolean;
  },
): Promise<AccountingCashCategoryRow> {
  const method = payload.id ? "PATCH" : "POST";
  const res = await fetch("/api/accounting/cash-book/categories", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "save_failed");
  return data.category as AccountingCashCategoryRow;
}

export async function reorderAccountingCashCategories(
  restaurantId: string,
  direction: AccountingCashDirection,
  reorder: string[],
) {
  const res = await fetch("/api/accounting/cash-book/categories", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, direction, reorder }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "reorder_failed");
}

export async function deleteAccountingCashCategory(
  restaurantId: string,
  id: string,
) {
  const params = new URLSearchParams({ restaurantId, id });
  const res = await fetch(`/api/accounting/cash-book/categories?${params}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "delete_failed");
}

export async function fetchAccountingCashBookSettings(
  restaurantId: string,
): Promise<AccountingCashBookSettingsRow> {
  const qs = new URLSearchParams({ restaurantId });
  const res = await fetch(`/api/accounting/cash-book/settings?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("cash_settings_load_failed");
  const data = (await res.json()) as { settings: AccountingCashBookSettingsRow };
  return data.settings;
}

export async function saveAccountingCashBookOpeningBalance(
  restaurantId: string,
  openingBalance: number,
): Promise<AccountingCashBookSettingsRow> {
  const res = await fetch("/api/accounting/cash-book/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, opening_balance: openingBalance }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "save_failed");
  return data.settings as AccountingCashBookSettingsRow;
}

export async function createAccountingCashEntry(
  restaurantId: string,
  input: AccountingCashEntryInput,
): Promise<AccountingCashEntryRow> {
  const res = await fetch("/api/accounting/cash-book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "create_failed");
  return data.entry as AccountingCashEntryRow;
}

export async function updateAccountingCashEntry(
  restaurantId: string,
  entryId: string,
  input: Partial<AccountingCashEntryInput>,
): Promise<AccountingCashEntryRow> {
  const res = await fetch(`/api/accounting/cash-book/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, restaurantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "update_failed");
  return data.entry as AccountingCashEntryRow;
}

export async function deleteAccountingCashEntry(
  restaurantId: string,
  entryId: string,
) {
  const params = new URLSearchParams({ restaurantId });
  const res = await fetch(`/api/accounting/cash-book/${entryId}?${params}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "delete_failed");
}
