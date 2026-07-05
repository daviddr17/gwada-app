"use client";

import type { RestaurantStaffTodoRow } from "@/lib/types/staff-todos";

const CACHE_PREFIX = "gwada:staff-todos:";
const DEFAULT_STALE_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * 60_000;

export type StaffTodosCachePayload = {
  at: number;
  todos: RestaurantStaffTodoRow[];
  restaurantTimezone: string;
};

const memory = new Map<string, StaffTodosCachePayload>();

function storageKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}`;
}

export function peekStaffTodosCache(
  restaurantId: string,
  maxAgeMs = MAX_AGE_MS,
): StaffTodosCachePayload | null {
  const fromMemory = memory.get(restaurantId);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffTodosCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(restaurantId, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeStaffTodosCache(
  restaurantId: string,
  payload: Omit<StaffTodosCachePayload, "at">,
): void {
  const entry: StaffTodosCachePayload = { at: Date.now(), ...payload };
  memory.set(restaurantId, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function isStaffTodosCacheFresh(
  restaurantId: string,
  staleMs = DEFAULT_STALE_MS,
): boolean {
  const cached = peekStaffTodosCache(restaurantId);
  if (!cached) return false;
  return Date.now() - cached.at <= staleMs;
}
