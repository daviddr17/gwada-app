"use client";

const CACHE_PREFIX = "gwada:pos-overview:";
const DEFAULT_STALE_MS = 30_000;
const MAX_AGE_MS = 15 * 60_000;

export type PosOverviewCachePayload = {
  at: number;
  activeCount: number | null;
  paidTodayCents: number | null;
  registerOpen: boolean | null;
};

const memory = new Map<string, PosOverviewCachePayload>();

function storageKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}`;
}

export function peekPosOverviewCache(
  restaurantId: string,
  maxAgeMs = MAX_AGE_MS,
): PosOverviewCachePayload | null {
  const fromMemory = memory.get(restaurantId);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PosOverviewCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(restaurantId, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writePosOverviewCache(
  restaurantId: string,
  payload: Omit<PosOverviewCachePayload, "at">,
): void {
  const entry: PosOverviewCachePayload = { at: Date.now(), ...payload };
  memory.set(restaurantId, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function isPosOverviewCacheFresh(
  restaurantId: string,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekPosOverviewCache(restaurantId);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
