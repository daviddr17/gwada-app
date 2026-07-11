"use client";

import { startOfLocalDay } from "@/lib/reservations/month-range";

const CACHE_PREFIX = "gwada:public-holidays:";
const MAX_AGE_MS = 24 * 60 * 60_000;

type HolidaysCacheEntry = {
  at: number;
  byDate: Record<string, string>;
};

const memory = new Map<string, HolidaysCacheEntry>();

function cacheKey(restaurantId: string, fromYmd: string, toYmd: string): string {
  return `${restaurantId}:${fromYmd}:${toYmd}`;
}

function storageKey(restaurantId: string, fromYmd: string, toYmd: string): string {
  return `${CACHE_PREFIX}${cacheKey(restaurantId, fromYmd, toYmd)}`;
}

export function peekPublicHolidaysCache(
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
  maxAgeMs = MAX_AGE_MS,
): Record<string, string> | null {
  const key = cacheKey(restaurantId, fromYmd, toYmd);
  const fromMemory = memory.get(key);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory.byDate;
  }

  if (typeof window === "undefined") return fromMemory?.byDate ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId, fromYmd, toYmd));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HolidaysCacheEntry;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed.byDate;
  } catch {
    return fromMemory?.byDate ?? null;
  }
}

export function writePublicHolidaysCache(
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
  byDate: Record<string, string>,
): void {
  const entry: HolidaysCacheEntry = { at: Date.now(), byDate };
  memory.set(cacheKey(restaurantId, fromYmd, toYmd), entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      storageKey(restaurantId, fromYmd, toYmd),
      JSON.stringify(entry),
    );
  } catch {
    /* quota */
  }
}

function currentMonthYmdRange(): { fromYmd: string; toYmd: string } {
  const now = new Date();
  const monthStart = startOfLocalDay(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const monthEnd = startOfLocalDay(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { fromYmd: fmt(monthStart), toYmd: fmt(monthEnd) };
}

export async function warmPublicHolidaysForCurrentMonth(
  restaurantId: string,
): Promise<void> {
  const { fromYmd, toYmd } = currentMonthYmdRange();
  if (peekPublicHolidaysCache(restaurantId, fromYmd, toYmd)) return;

  try {
    const params = new URLSearchParams({
      restaurantId,
      from: fromYmd,
      to: toYmd,
    });
    const res = await fetch(`/api/holidays/range?${params}`);
    const data = (await res.json().catch(() => ({}))) as {
      byDate?: Record<string, string>;
    };
    if (res.ok && data.byDate) {
      writePublicHolidaysCache(restaurantId, fromYmd, toYmd, data.byDate);
    }
  } catch {
    /* background warm */
  }
}
