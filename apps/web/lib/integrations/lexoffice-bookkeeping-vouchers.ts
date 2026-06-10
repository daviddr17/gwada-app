import "server-only";

import { randomUUID } from "crypto";
import { fetchLexofficeJson, LEXOFFICE_API_BASE } from "@/lib/integrations/lexoffice-api";
import {
  getLexofficeCache,
  lexofficeCacheKey,
  LEXOFFICE_DETAIL_CACHE_MS,
  LEXOFFICE_FILE_CACHE_MS,
  setLexofficeCache,
} from "@/lib/integrations/lexoffice-api-cache";
import { fetchRestaurantLexofficeApiKey } from "@/lib/supabase/restaurant-lexoffice-integration-db";
import type {
  AccountingVoucherInput,
  AccountingVoucherItem,
  AccountingVoucherKind,
} from "@/lib/types/accounting";

const LEXWARE_APP_BASE = "https://app.lexware.de";

export type LexofficeBookkeepingDetail = {
  id: string;
  version?: number;
  type?: string;
  voucherStatus?: string;
  voucherNumber?: string | null;
  voucherDate?: string;
  dueDate?: string | null;
  shippingDate?: string | null;
  totalGrossAmount?: number;
  totalTaxAmount?: number;
  taxType?: string;
  useCollectiveContact?: boolean;
  contactId?: string | null;
  contactName?: string | null;
  remark?: string | null;
  voucherItems?: Array<{
    amount?: number;
    taxAmount?: number;
    taxRatePercent?: number;
    categoryId?: string;
  }>;
  files?: unknown[];
};

type PostingCategory = { id: string; name: string; type?: string };

async function lexofficeFetch<T>(
  restaurantId: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) {
    return { ok: false, error: "Lexware ist nicht verbunden." };
  }

  const result = await fetchLexofficeJson<T>(apiKey, path, init);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: result.data };
}

export function lexofficeBookkeepingEditUrl(externalId: string): string {
  return `${LEXWARE_APP_BASE}/permalink/vouchers/edit/${externalId}`;
}

export function lexofficeVoucherFileId(files: unknown): string | null {
  if (!Array.isArray(files) || files.length === 0) return null;
  const first = files[0];
  if (typeof first === "string" && first.trim()) return first.trim();
  if (
    first &&
    typeof first === "object" &&
    "id" in first &&
    typeof (first as { id: unknown }).id === "string"
  ) {
    return (first as { id: string }).id.trim() || null;
  }
  return null;
}

export function mapLexofficeBookkeepingTypeToKind(
  type: string | undefined,
): AccountingVoucherKind {
  const t = (type ?? "").toLowerCase();
  if (t === "salesinvoice" || t === "salescreditnote") return "sales";
  if (t === "purchaseinvoice" || t === "purchasecreditnote") return "purchase";
  return "expense";
}

export function mapGwadaKindToLexofficeType(
  kind: AccountingVoucherKind,
): "salesinvoice" | "salescreditnote" | "purchaseinvoice" | "purchasecreditnote" {
  if (kind === "sales" || kind === "income") return "salesinvoice";
  if (kind === "purchase") return "purchaseinvoice";
  return "purchaseinvoice";
}

export function mapGwadaKindToLexofficeCreditType(
  kind: AccountingVoucherKind,
  originalLexType?: string | null,
): "salescreditnote" | "purchasecreditnote" {
  const t = (originalLexType ?? "").toLowerCase();
  if (t === "salescreditnote" || t === "salesinvoice") return "salescreditnote";
  if (t === "purchasecreditnote" || t === "purchaseinvoice") {
    return "purchasecreditnote";
  }
  if (kind === "sales" || kind === "income") return "salescreditnote";
  return "purchasecreditnote";
}

export function mapLexofficeBookkeepingStatus(status: string | undefined): string {
  const s = (status ?? "open").toLowerCase();
  if (s === "unchecked") return "unchecked";
  if (s === "voided" || s === "void") return "voided";
  if (s === "paid" || s === "paidoff") return "paid";
  if (s === "draft" || s === "blank") return "draft";
  return "open";
}

export function voucherItemsFromLexoffice(
  detail: LexofficeBookkeepingDetail,
): AccountingVoucherItem[] {
  return (detail.voucherItems ?? []).map((raw, index) => ({
    id: randomUUID(),
    sortOrder: index,
    label: `Steuer ${raw.taxRatePercent ?? 0} %`,
    amount: Number(raw.amount ?? 0),
    taxAmount: Number(raw.taxAmount ?? 0),
    taxRatePercent: Number(raw.taxRatePercent ?? 0),
    categoryLabel: null,
  }));
}

async function fetchDefaultPostingCategoryId(
  restaurantId: string,
  lexType: ReturnType<typeof mapGwadaKindToLexofficeType>,
): Promise<string | null> {
  const result = await lexofficeFetch<PostingCategory[]>(
    restaurantId,
    "/v1/posting-categories",
  );
  if (!result.ok || !result.data.length) return null;

  const wantIncome = lexType === "salesinvoice" || lexType === "salescreditnote";
  const match = result.data.find((c) =>
    wantIncome ? c.type === "income" : c.type === "outgo",
  );
  return match?.id ?? result.data[0]?.id ?? null;
}

function buildLexofficeVoucherBody(
  input: AccountingVoucherInput,
  items: AccountingVoucherItem[],
  totals: { totalGross: number; totalTax: number },
  categoryId: string,
  lexType: ReturnType<typeof mapGwadaKindToLexofficeType>,
) {
  const lexId = input.lexofficeContactId?.trim();
  const useCollective = !lexId;
  return {
    type: lexType,
    voucherStatus: input.status === "unchecked" ? "unchecked" : "open",
    voucherNumber: input.voucherNumber?.trim() || undefined,
    voucherDate: input.voucherDate,
    dueDate: input.dueDate ?? undefined,
    shippingDate: input.shippingDate ?? undefined,
    totalGrossAmount: totals.totalGross,
    totalTaxAmount: totals.totalTax,
    taxType: input.taxMode,
    useCollectiveContact: useCollective,
    contactId: lexId || undefined,
    contactName: useCollective ? input.contactName?.trim() || undefined : undefined,
    remark: input.remark?.trim() || undefined,
    voucherItems: items.map((item) => ({
      amount: item.amount,
      taxAmount: item.taxAmount,
      taxRatePercent: item.taxRatePercent,
      categoryId,
    })),
  };
}

export async function createLexofficeBookkeepingVoucher(
  restaurantId: string,
  input: AccountingVoucherInput,
  items: AccountingVoucherItem[],
  totals: { totalGross: number; totalTax: number },
  opts?: {
    lexofficeType?: ReturnType<typeof mapGwadaKindToLexofficeType>;
  },
): Promise<
  | {
      ok: true;
      externalId: string;
      externalVersion: number | null;
      externalEditUrl: string;
      voucherNumber: string | null;
      status: string;
      lexofficeVoucherType: string;
    }
  | { ok: false; error: string }
> {
  const lexType =
    opts?.lexofficeType ?? mapGwadaKindToLexofficeType(input.voucherKind);
  const categoryId = await fetchDefaultPostingCategoryId(restaurantId, lexType);
  if (!categoryId) {
    return {
      ok: false,
      error: "Keine Buchungskategorie in Lexware gefunden.",
    };
  }

  const body = buildLexofficeVoucherBody(
    input,
    items,
    totals,
    categoryId,
    lexType,
  );
  const created = await lexofficeFetch<{
    id: string;
    version?: number;
  }>(restaurantId, "/v1/vouchers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!created.ok) return created;

  let voucherNumber = input.voucherNumber ?? null;
  let status = mapLexofficeBookkeepingStatus(body.voucherStatus);

  const detail = await fetchLexofficeBookkeepingDetail(
    restaurantId,
    created.data.id,
  );
  if (detail.ok) {
    voucherNumber = detail.detail.voucherNumber ?? voucherNumber;
    status = mapLexofficeBookkeepingStatus(detail.detail.voucherStatus);
  }

  return {
    ok: true,
    externalId: created.data.id,
    externalVersion: created.data.version ?? null,
    externalEditUrl: lexofficeBookkeepingEditUrl(created.data.id),
    voucherNumber,
    status,
    lexofficeVoucherType: lexType,
  };
}

export async function uploadLexofficeBookkeepingVoucherFile(
  restaurantId: string,
  externalId: string,
  file: { buffer: Buffer; fileName: string; mimeType: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) {
    return { ok: false, error: "Lexware ist nicht verbunden." };
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
    file.fileName,
  );

  let res: Response;
  try {
    res = await fetch(
      `${LEXOFFICE_API_BASE}/v1/vouchers/${externalId}/files`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        body: form,
        cache: "no-store",
      },
    );
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text || `Lexware API (${res.status})` };
  }

  return { ok: true };
}

export async function fetchLexofficeBookkeepingDetail(
  restaurantId: string,
  externalId: string,
  opts?: { skipCache?: boolean },
): Promise<
  | { ok: true; detail: LexofficeBookkeepingDetail }
  | { ok: false; error: string }
> {
  const path = `/v1/vouchers/${externalId}`;
  const cacheKey = lexofficeCacheKey(restaurantId, path);

  if (!opts?.skipCache) {
    const cached = getLexofficeCache<LexofficeBookkeepingDetail>(cacheKey);
    if (cached) {
      return { ok: true, detail: cached };
    }
  }

  const result = await lexofficeFetch<LexofficeBookkeepingDetail>(
    restaurantId,
    path,
  );
  if (!result.ok) return result;

  setLexofficeCache(cacheKey, result.data, LEXOFFICE_DETAIL_CACHE_MS);
  return { ok: true, detail: result.data };
}

export async function fetchLexofficeBookkeepingVoucherFile(
  restaurantId: string,
  externalId: string,
  knownFileId?: string | null,
): Promise<
  | { ok: true; buffer: Buffer; contentType: string; filename: string }
  | { ok: false; error: string }
> {
  const trimmedKnown = knownFileId?.trim() || null;
  if (trimmedKnown === "") {
    return { ok: false, error: "Kein Belegbild in Lexware hinterlegt." };
  }

  let firstFileId = trimmedKnown;

  if (!firstFileId) {
    const detail = await fetchLexofficeBookkeepingDetail(restaurantId, externalId);
    if (!detail.ok) return detail;

    firstFileId = lexofficeVoucherFileId(detail.detail.files);
    if (!firstFileId) {
      return { ok: false, error: "Kein Belegbild in Lexware hinterlegt." };
    }
  }

  const filePath = `/v1/files/${firstFileId}`;
  const fileCacheKey = lexofficeCacheKey(restaurantId, filePath);
  const cachedFile = getLexofficeCache<{
    buffer: Buffer;
    contentType: string;
  }>(fileCacheKey);
  if (cachedFile) {
    return {
      ok: true,
      buffer: cachedFile.buffer,
      contentType: cachedFile.contentType,
      filename: `beleg-${externalId.slice(0, 8)}`,
    };
  }

  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) {
    return { ok: false, error: "Lexware ist nicht verbunden." };
  }

  let res: Response;
  try {
    res = await fetch(`${LEXOFFICE_API_BASE}${filePath}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "*/*",
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok) {
    return { ok: false, error: `Lexware Datei (${res.status})` };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() ??
    "application/octet-stream";
  setLexofficeCache(fileCacheKey, { buffer, contentType }, LEXOFFICE_FILE_CACHE_MS);

  return {
    ok: true,
    buffer,
    contentType,
    filename: `beleg-${externalId.slice(0, 8)}`,
  };
}
