"use client";

import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";

const CACHE_PREFIX = "gwada:reservations-month:";
const DEFAULT_STALE_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type ReservationsMonthRange = {
  rangeStartIso: string;
  rangeEndExclusiveIso: string;
};

export type ReservationsMonthCachePayload = {
  at: number;
  rows: ReservationListRow[];
};

const memory = new Map<string, ReservationsMonthCachePayload>();

function memoryKey(restaurantId: string, range: ReservationsMonthRange): string {
  return `${restaurantId}:${range.rangeStartIso}:${range.rangeEndExclusiveIso}`;
}

function storageKey(restaurantId: string, range: ReservationsMonthRange): string {
  return `${CACHE_PREFIX}${memoryKey(restaurantId, range)}`;
}

export function currentMonthReservationRange(): ReservationsMonthRange {
  const now = new Date();
  const monthStart = startOfLocalDay(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const monthEnd = startOfLocalDay(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );
  return {
    rangeStartIso: localDayStartToUtcIso(monthStart),
    rangeEndExclusiveIso: exclusiveUtcIsoAfterLocalVisibleEnd(monthEnd),
  };
}

export function peekReservationsMonthCache(
  restaurantId: string,
  range: ReservationsMonthRange,
  maxAgeMs = MAX_AGE_MS,
): ReservationsMonthCachePayload | null {
  const key = memoryKey(restaurantId, range);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId, range));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReservationsMonthCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeReservationsMonthCache(
  restaurantId: string,
  range: ReservationsMonthRange,
  rows: ReservationListRow[],
): void {
  const entry: ReservationsMonthCachePayload = { at: Date.now(), rows };
  const key = memoryKey(restaurantId, range);
  memory.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      storageKey(restaurantId, range),
      JSON.stringify(entry),
    );
  } catch {
    /* quota */
  }
}

export function isReservationsMonthCacheFresh(
  restaurantId: string,
  range: ReservationsMonthRange,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekReservationsMonthCache(restaurantId, range);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
