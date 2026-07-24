"use client";

import type {
  AccountingArticleRow,
  AccountingDocumentStatusRow,
  AccountingTaxRateRow,
  AccountingUnitRow,
  AccountingVoucherRow,
} from "@/lib/types/accounting";
import type {
  AccountingCashBookSummary,
  AccountingCashCategoryRow,
  AccountingCashEntryRow,
} from "@/lib/types/accounting-cash-book";

const CACHE_PREFIX = "gwada:accounting-list:";
const DEFAULT_STALE_MS = 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type AccountingListMeta = {
  page: number;
  totalPages: number;
  totalCount: number;
};

export type AccountingCatalogSlice = {
  taxRates: AccountingTaxRateRow[];
  units: AccountingUnitRow[];
  articles: AccountingArticleRow[];
};

type Timed<T> = T & { at: number };

export type AccountingSalesListCachePayload = Timed<{
  rows: unknown[];
  listMeta: AccountingListMeta;
  catalog: AccountingCatalogSlice;
  statuses: AccountingDocumentStatusRow[];
}>;

export type AccountingVoucherListCachePayload = Timed<{
  rows: AccountingVoucherRow[];
  listMeta: AccountingListMeta;
  catalog: AccountingCatalogSlice | null;
  statuses: AccountingDocumentStatusRow[];
}>;

export type AccountingCashBookCachePayload = Timed<{
  entries: AccountingCashEntryRow[];
  summary: AccountingCashBookSummary | null;
  page: number;
  totalPages: number;
  totalCount: number;
  categories: AccountingCashCategoryRow[];
  taxRates: AccountingTaxRateRow[];
  voucherStatuses: AccountingDocumentStatusRow[];
}>;

export type AccountingStatisticsCachePayload = Timed<{
  monthsBack: number;
  bundle: unknown;
}>;

const memory = new Map<string, Timed<unknown>>();

function storageKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

function peekTimed<T extends Timed<unknown>>(
  key: string,
  maxAgeMs = MAX_AGE_MS,
): T | null {
  const fromMemory = memory.get(key) as T | undefined;
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }
  if (typeof window === "undefined") return fromMemory ?? null;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

function writeTimed<T extends Timed<unknown>>(key: string, payload: T): void {
  memory.set(key, payload);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function accountingSalesListCacheKey(input: {
  restaurantId: string;
  kind: "invoice" | "quotation";
  source: string;
  status: string;
  variant: string;
  search: string;
  page: number;
  sortKey: string;
  sortDir: string;
}): string {
  return [
    input.restaurantId,
    "sales",
    input.kind,
    input.source,
    input.status,
    input.variant,
    input.search.trim().toLowerCase(),
    input.page,
    input.sortKey,
    input.sortDir,
  ].join(":");
}

export function peekAccountingSalesListCache(
  key: string,
): AccountingSalesListCachePayload | null {
  return peekTimed<AccountingSalesListCachePayload>(key);
}

export function writeAccountingSalesListCache(
  key: string,
  payload: Omit<AccountingSalesListCachePayload, "at">,
): void {
  writeTimed(key, { at: Date.now(), ...payload });
}

export function accountingVoucherListCacheKey(input: {
  restaurantId: string;
  source: string;
  status: string;
  variant: string;
  voucherKind: string;
  search: string;
  page: number;
  sortKey: string;
  sortDir: string;
  canManage: boolean;
}): string {
  return [
    input.restaurantId,
    "voucher",
    input.source,
    input.status,
    input.variant,
    input.voucherKind,
    input.search.trim().toLowerCase(),
    input.page,
    input.sortKey,
    input.sortDir,
    input.canManage ? "1" : "0",
  ].join(":");
}

export function peekAccountingVoucherListCache(
  key: string,
): AccountingVoucherListCachePayload | null {
  return peekTimed<AccountingVoucherListCachePayload>(key);
}

export function writeAccountingVoucherListCache(
  key: string,
  payload: Omit<AccountingVoucherListCachePayload, "at">,
): void {
  writeTimed(key, { at: Date.now(), ...payload });
}

export function accountingCashBookCacheKey(input: {
  restaurantId: string;
  page: number;
  search: string;
}): string {
  return [
    input.restaurantId,
    "cash",
    input.page,
    input.search.trim().toLowerCase(),
  ].join(":");
}

export function peekAccountingCashBookCache(
  key: string,
): AccountingCashBookCachePayload | null {
  return peekTimed<AccountingCashBookCachePayload>(key);
}

export function writeAccountingCashBookCache(
  key: string,
  payload: Omit<AccountingCashBookCachePayload, "at">,
): void {
  writeTimed(key, { at: Date.now(), ...payload });
}

export function accountingStatisticsCacheKey(
  restaurantId: string,
  monthsBack: number,
): string {
  return `${restaurantId}:stats:${monthsBack}`;
}

export function peekAccountingStatisticsCache(
  key: string,
): AccountingStatisticsCachePayload | null {
  return peekTimed<AccountingStatisticsCachePayload>(key);
}

export function writeAccountingStatisticsCache(
  key: string,
  payload: Omit<AccountingStatisticsCachePayload, "at">,
): void {
  writeTimed(key, { at: Date.now(), ...payload });
}

export function isAccountingListCacheFresh(
  key: string,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekTimed(key);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
