import type {
  AccountingArticleRow,
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

export async function fetchAccountingInvoices(
  restaurantId: string,
  source?: string,
): Promise<AccountingInvoiceRow[]> {
  const params = new URLSearchParams({ restaurantId });
  if (source && source !== "all") params.set("source", source);
  const res = await fetch(`/api/accounting/invoices?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("invoices_load_failed");
  const data = (await res.json()) as { invoices: AccountingInvoiceRow[] };
  return data.invoices;
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
  source?: string,
): Promise<AccountingQuotationRow[]> {
  const params = new URLSearchParams({ restaurantId });
  if (source && source !== "all") params.set("source", source);
  const res = await fetch(`/api/accounting/quotations?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("quotations_load_failed");
  const data = (await res.json()) as { quotations: AccountingQuotationRow[] };
  return data.quotations;
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
    documentDesign?: import("@/lib/types/accounting-settings").AccountingDocumentDesign;
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

export async function syncLexofficeSalesDocuments(
  restaurantId: string,
  kind: "invoice" | "quotation",
) {
  const res = await fetch("/api/accounting/sync-lexoffice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, kind }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "sync_failed");
  return data as { imported: number; updated: number };
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
  },
) {
  const method = payload.id ? "PATCH" : "POST";
  return catalogJson("/api/accounting/catalog/articles", method, {
    ...payload,
    restaurantId,
  });
}
