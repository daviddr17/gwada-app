"use client";

import type {
  RestaurantDocumentRow,
  RestaurantDocumentsStorageUsage,
} from "@/lib/types/documents";

const CACHE_PREFIX = "gwada:documents-list:";
const DEFAULT_STALE_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type DocumentsListCachePayload = {
  at: number;
  rows: RestaurantDocumentRow[];
  usage: RestaurantDocumentsStorageUsage;
};

const memory = new Map<string, DocumentsListCachePayload>();

function storageKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}`;
}

export function peekDocumentsListCache(
  restaurantId: string,
  maxAgeMs = MAX_AGE_MS,
): DocumentsListCachePayload | null {
  const fromMemory = memory.get(restaurantId);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DocumentsListCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(restaurantId, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeDocumentsListCache(
  restaurantId: string,
  payload: Omit<DocumentsListCachePayload, "at">,
): void {
  const entry: DocumentsListCachePayload = { at: Date.now(), ...payload };
  memory.set(restaurantId, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function isDocumentsListCacheFresh(
  restaurantId: string,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekDocumentsListCache(restaurantId);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
