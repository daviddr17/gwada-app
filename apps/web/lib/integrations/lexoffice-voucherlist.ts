import "server-only";

import {
  fetchLexofficeJson,
  LEXOFFICE_API_BASE,
} from "@/lib/integrations/lexoffice-api";
import {
  getLexofficeCache,
  invalidateLexofficeCachePrefix,
  isLexofficeRateLimited,
  lexofficeCacheKey,
  LEXOFFICE_DETAIL_CACHE_MS,
  LEXOFFICE_DETAIL_FETCH_DELAY_MS,
  LEXOFFICE_LIST_CACHE_MS,
  markLexofficeRateLimited,
  setLexofficeCache,
} from "@/lib/integrations/lexoffice-api-cache";
import { isLexofficeRateLimitError } from "@/lib/accounting/lexoffice-rate-limit";
import { fetchRestaurantLexofficeApiKey } from "@/lib/supabase/restaurant-lexoffice-integration-db";

export type LexofficeVoucherListItem = {
  id: string;
  voucherType: string;
  voucherStatus: string;
  voucherNumber: string | null;
  voucherDate: string;
  dueDate?: string | null;
  contactId: string | null;
  contactName: string | null;
  totalAmount: number | null;
  currency: string | null;
  updatedDate?: string | null;
};

type VoucherListResponse = {
  content?: LexofficeVoucherListItem[];
  totalPages?: number;
  number?: number;
};

/** Lexware voucherlist filter types per sales document kind (Invoicing API, not bookkeeping-only). */
function lexofficeVoucherListTypes(kind: "invoice" | "quotation"): string {
  return kind === "invoice"
    ? "invoice,downpaymentinvoice,creditnote"
    : "quotation";
}

function salesDetailApiPath(
  kind: "invoice" | "quotation",
  externalId: string,
  lexofficeVoucherType?: string,
): string {
  const t = (lexofficeVoucherType ?? "").toLowerCase();
  if (t === "creditnote") return `/v1/credit-notes/${externalId}`;
  if (t === "quotation") return `/v1/quotations/${externalId}`;
  if (t === "downpaymentinvoice") {
    return `/v1/down-payment-invoices/${externalId}`;
  }
  if (t === "invoice") {
    return `/v1/invoices/${externalId}`;
  }
  return kind === "invoice"
    ? `/v1/invoices/${externalId}`
    : `/v1/quotations/${externalId}`;
}

async function lexofficeFetch<T>(
  restaurantId: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (isLexofficeRateLimited(restaurantId)) {
    return { ok: false, error: "Lexware API: Rate-Limit erreicht." };
  }

  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) {
    return { ok: false, error: "Lexware ist nicht verbunden." };
  }

  const result = await fetchLexofficeJson<T>(apiKey, path, init);
  if (!result.ok) {
    if (result.status === 429 || isLexofficeRateLimitError(result.error)) {
      markLexofficeRateLimited(restaurantId);
    }
    return { ok: false, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function fetchLexofficeVoucherListPage(
  restaurantId: string,
  params: {
    voucherType: "invoice" | "quotation";
    page?: number;
    size?: number;
  },
  opts?: { skipCache?: boolean },
): Promise<
  | { ok: true; items: LexofficeVoucherListItem[]; totalPages: number }
  | { ok: false; error: string }
> {
  const page = params.page ?? 0;
  const size = params.size ?? 100;
  const qs = new URLSearchParams({
    voucherType: lexofficeVoucherListTypes(params.voucherType),
    voucherStatus: "any",
    page: String(page),
    size: String(size),
  });
  const path = `/v1/voucherlist?${qs}`;
  const cacheKey = lexofficeCacheKey(restaurantId, path);

  if (!opts?.skipCache) {
    const cached = getLexofficeCache<{
      items: LexofficeVoucherListItem[];
      totalPages: number;
    }>(cacheKey);
    if (cached) {
      return { ok: true, ...cached };
    }
  }

  const result = await lexofficeFetch<VoucherListResponse>(restaurantId, path);
  if (!result.ok) return result;

  const payload = {
    items: result.data.content ?? [],
    totalPages: Math.max(result.data.totalPages ?? 1, 1),
  };
  setLexofficeCache(cacheKey, payload, LEXOFFICE_LIST_CACHE_MS);

  return { ok: true, ...payload };
}

export async function fetchAllLexofficeVoucherList(
  restaurantId: string,
  voucherType: "invoice" | "quotation",
  opts?: { skipCache?: boolean },
): Promise<
  | { ok: true; items: LexofficeVoucherListItem[] }
  | { ok: false; error: string }
> {
  const all: LexofficeVoucherListItem[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    if (page > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, LEXOFFICE_DETAIL_FETCH_DELAY_MS),
      );
    }
    const batch = await fetchLexofficeVoucherListPage(
      restaurantId,
      {
        voucherType,
        page,
      },
      opts,
    );
    if (!batch.ok) return batch;
    all.push(...batch.items);
    totalPages = batch.totalPages;
    page += 1;
    if (page > 50) break;
  }

  return { ok: true, items: all };
}

const LEXOFFICE_BOOKKEEPING_VOUCHER_TYPES =
  "purchaseinvoice,purchasecreditnote,salesinvoice,salescreditnote";

export async function fetchLexofficeBookkeepingVoucherListPage(
  restaurantId: string,
  params: { page?: number; size?: number },
  opts?: { skipCache?: boolean },
): Promise<
  | { ok: true; items: LexofficeVoucherListItem[]; totalPages: number }
  | { ok: false; error: string }
> {
  const page = params.page ?? 0;
  const size = params.size ?? 100;
  const qs = new URLSearchParams({
    voucherType: LEXOFFICE_BOOKKEEPING_VOUCHER_TYPES,
    voucherStatus: "any",
    page: String(page),
    size: String(size),
  });
  const path = `/v1/voucherlist?${qs}`;
  const cacheKey = lexofficeCacheKey(restaurantId, path);

  if (!opts?.skipCache) {
    const cached = getLexofficeCache<{
      items: LexofficeVoucherListItem[];
      totalPages: number;
    }>(cacheKey);
    if (cached) {
      return { ok: true, ...cached };
    }
  }

  const result = await lexofficeFetch<VoucherListResponse>(restaurantId, path);
  if (!result.ok) return result;

  const payload = {
    items: result.data.content ?? [],
    totalPages: Math.max(result.data.totalPages ?? 1, 1),
  };
  setLexofficeCache(cacheKey, payload, LEXOFFICE_LIST_CACHE_MS);

  return { ok: true, ...payload };
}

export async function fetchAllLexofficeBookkeepingVoucherList(
  restaurantId: string,
  opts?: { skipCache?: boolean },
): Promise<
  | { ok: true; items: LexofficeVoucherListItem[] }
  | { ok: false; error: string }
> {
  const all: LexofficeVoucherListItem[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    if (page > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, LEXOFFICE_DETAIL_FETCH_DELAY_MS),
      );
    }
    const batch = await fetchLexofficeBookkeepingVoucherListPage(
      restaurantId,
      { page },
      opts,
    );
    if (!batch.ok) return batch;
    all.push(...batch.items);
    totalPages = batch.totalPages;
    page += 1;
    if (page > 50) break;
  }

  return { ok: true, items: all };
}

export type LexofficeSalesDetail = {
  id: string;
  version?: number;
  voucherNumber?: string | null;
  voucherStatus?: string;
  voucherDate?: string;
  dueDate?: string | null;
  expirationDate?: string | null;
  address?: {
    name?: string;
    supplement?: string;
    street?: string;
    city?: string;
    zip?: string;
    countryCode?: string;
  };
  lineItems?: Array<Record<string, unknown>>;
  totalPrice?: {
    currency?: string;
    totalNetAmount?: number;
    totalGrossAmount?: number;
    totalTaxAmount?: number;
  };
  taxConditions?: { taxType?: string };
  title?: string | null;
  introduction?: string | null;
  remark?: string | null;
};

export async function fetchLexofficeSalesDetail(
  restaurantId: string,
  kind: "invoice" | "quotation",
  externalId: string,
  lexofficeVoucherType?: string,
  opts?: { skipCache?: boolean },
): Promise<
  | { ok: true; detail: LexofficeSalesDetail }
  | { ok: false; error: string }
> {
  const path = salesDetailApiPath(kind, externalId, lexofficeVoucherType);
  const cacheKey = lexofficeCacheKey(restaurantId, path);

  if (!opts?.skipCache) {
    const cached = getLexofficeCache<LexofficeSalesDetail>(cacheKey);
    if (cached) {
      return { ok: true, detail: cached };
    }
  }

  const result = await lexofficeFetch<LexofficeSalesDetail>(restaurantId, path);
  if (!result.ok) return result;

  setLexofficeCache(cacheKey, result.data, LEXOFFICE_DETAIL_CACHE_MS);
  return { ok: true, detail: result.data };
}

export async function fetchLexofficeSalesDocumentFile(
  restaurantId: string,
  kind: "invoice" | "quotation",
  externalId: string,
  format: "pdf" | "xml",
): Promise<
  | { ok: true; buffer: Buffer; contentType: string; filename: string }
  | { ok: false; error: string }
> {
  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) {
    return { ok: false, error: "Lexware ist nicht verbunden." };
  }

  const accept = format === "pdf" ? "application/pdf" : "application/xml";
  const path =
    kind === "invoice"
      ? `/v1/invoices/${externalId}/file`
      : `/v1/quotations/${externalId}/file`;

  let res: Response;
  try {
    res = await fetch(`${LEXOFFICE_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: accept,
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error:
        format === "xml"
          ? "ZUGFeRD/XML für dieses Dokument nicht verfügbar."
          : text || `Lexware API (${res.status})`,
    };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = format === "pdf" ? "pdf" : "xml";
  const prefix = kind === "invoice" ? "Rechnung" : "Angebot";
  return {
    ok: true,
    buffer,
    contentType: accept,
    filename: `${prefix}-${externalId.slice(0, 8)}.${ext}`,
  };
}

const LEXWARE_APP_BASE = "https://app.lexware.de";

export function lexofficeEditUrl(
  kind: "invoice" | "quotation",
  externalId: string,
): string {
  const segment = kind === "invoice" ? "invoices" : "quotations";
  return `${LEXWARE_APP_BASE}/permalink/${segment}/edit/${externalId}`;
}

export function mapLexofficeVoucherStatus(
  status: string | undefined,
  kind: "invoice" | "quotation",
): string {
  const s = (status ?? "draft").toLowerCase();
  if (s === "draft") return "draft";
  if (s === "open") return "open";
  if (s === "paid" || s === "paidoff") return kind === "invoice" ? "paid" : "open";
  if (s === "transferred" || s === "sepadebit") return "open";
  if (s === "voided" || s === "void") return "voided";
  if (s === "overdue") return "overdue";
  if (s === "accepted") return "accepted";
  if (s === "rejected") return "rejected";
  if (s === "sent") return "sent";
  return "open";
}

export function mapLexofficeTaxMode(taxType: string | undefined): string {
  if (taxType === "gross") return "gross";
  if (taxType === "vatfree") return "vatfree";
  return "net";
}
