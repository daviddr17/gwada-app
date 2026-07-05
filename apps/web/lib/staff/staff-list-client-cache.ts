"use client";

import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
} from "@/lib/types/staff";

const CACHE_PREFIX = "gwada:staff-list:";
const DEFAULT_STALE_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type StaffListCachePayload = {
  at: number;
  rows: RestaurantStaffRow[];
  contracts: RestaurantStaffContractRow[];
};

const memory = new Map<string, StaffListCachePayload>();

function storageKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}`;
}

export function peekStaffListCache(
  restaurantId: string,
  maxAgeMs = MAX_AGE_MS,
): StaffListCachePayload | null {
  const fromMemory = memory.get(restaurantId);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffListCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(restaurantId, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeStaffListCache(
  restaurantId: string,
  payload: Omit<StaffListCachePayload, "at">,
): void {
  const entry: StaffListCachePayload = { at: Date.now(), ...payload };
  memory.set(restaurantId, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function patchStaffListCacheRows(
  restaurantId: string,
  rows: RestaurantStaffRow[],
): void {
  const cached = peekStaffListCache(restaurantId);
  writeStaffListCache(restaurantId, {
    rows,
    contracts: cached?.contracts ?? [],
  });
}

export function patchStaffListCacheContracts(
  restaurantId: string,
  contracts: RestaurantStaffContractRow[],
): void {
  const cached = peekStaffListCache(restaurantId);
  writeStaffListCache(restaurantId, {
    rows: cached?.rows ?? [],
    contracts,
  });
}

export function isStaffListCacheFresh(
  restaurantId: string,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekStaffListCache(restaurantId);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
