"use client";

import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";

const STORAGE_KEY_V2 = "gwada:live-activity-feed:v2";
const STORAGE_KEY_V1 = "gwada:live-activity-feed:v1";
const MAX_ITEMS = 80;

type StoreState = {
  restaurantId: string | null;
  dayKey: string | null;
  items: LiveActivityItem[];
};

type Listener = () => void;

let state: StoreState = { restaurantId: null, dayKey: null, items: [] };
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function persistKey(restaurantId: string, dayKey: string): string {
  return `${STORAGE_KEY_V2}:${restaurantId}:${dayKey}`;
}

function readPersisted(
  restaurantId: string,
  dayKey: string,
): LiveActivityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(persistKey(restaurantId, dayKey));
    if (raw) {
      const parsed = JSON.parse(raw) as LiveActivityItem[];
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_ITEMS);
    }
    // Einmal-Migration von Session v1 (gleicher Tag)
    const legacy = sessionStorage.getItem(`${STORAGE_KEY_V1}:${restaurantId}`);
    if (!legacy) return [];
    const parsedLegacy = JSON.parse(legacy) as LiveActivityItem[];
    if (!Array.isArray(parsedLegacy)) return [];
    const todayOnly = parsedLegacy
      .filter((row) => restaurantTodayYmd() === dayKey)
      .slice(0, MAX_ITEMS);
    if (todayOnly.length > 0) {
      writePersisted(restaurantId, dayKey, todayOnly);
    }
    return todayOnly;
  } catch {
    return [];
  }
}

function writePersisted(
  restaurantId: string,
  dayKey: string,
  items: LiveActivityItem[],
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      persistKey(restaurantId, dayKey),
      JSON.stringify(items.slice(0, MAX_ITEMS)),
    );
  } catch {
    /* ignore quota */
  }
}

export function ensureLiveActivityRestaurant(
  restaurantId: string,
  dayKey: string = restaurantTodayYmd(),
) {
  if (state.restaurantId === restaurantId && state.dayKey === dayKey) return;
  state = {
    restaurantId,
    dayKey,
    items: readPersisted(restaurantId, dayKey),
  };
  emit();
}

export function getLiveActivityItems(): LiveActivityItem[] {
  return state.items;
}

export function subscribeLiveActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordLiveActivity(
  restaurantId: string,
  item: Omit<LiveActivityItem, "id" | "at"> & {
    id?: string;
    at?: string;
  },
  dayKey: string = restaurantTodayYmd(),
) {
  ensureLiveActivityRestaurant(restaurantId, dayKey);
  const next: LiveActivityItem = {
    id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: item.kind,
    module: item.module,
    title: item.title,
    description: item.description ?? null,
    href: item.href ?? null,
    at: item.at ?? new Date().toISOString(),
  };

  const dup = state.items.find(
    (row) =>
      row.id === next.id ||
      (row.title === next.title &&
        row.description === next.description &&
        Math.abs(new Date(row.at).getTime() - new Date(next.at).getTime()) <
          2_000),
  );
  if (dup) return;

  state = {
    restaurantId,
    dayKey,
    items: [next, ...state.items].slice(0, MAX_ITEMS),
  };
  writePersisted(restaurantId, dayKey, state.items);
  emit();
}

/** Server-Backfill: fehlende IDs ergänzen (ohne Duplikate). */
export function mergeLiveActivityItems(
  restaurantId: string,
  items: readonly LiveActivityItem[],
  dayKey: string = restaurantTodayYmd(),
) {
  if (items.length === 0) return;
  ensureLiveActivityRestaurant(restaurantId, dayKey);
  const existingIds = new Set(state.items.map((row) => row.id));
  const toAdd = items.filter((row) => !existingIds.has(row.id));
  if (toAdd.length === 0) return;

  const merged = [...toAdd, ...state.items]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, MAX_ITEMS);

  state = { restaurantId, dayKey, items: merged };
  writePersisted(restaurantId, dayKey, merged);
  emit();
}

export function clearLiveActivitySeenDot(restaurantId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY_V2}:seen:${restaurantId}`,
      state.items[0]?.at ?? new Date().toISOString(),
    );
  } catch {
    /* ignore */
  }
  emit();
}

/** Verlauf leeren (nur heutiger Tag im Speicher). */
export function clearLiveActivityFeed(restaurantId: string) {
  const dayKey = state.dayKey ?? restaurantTodayYmd();
  ensureLiveActivityRestaurant(restaurantId, dayKey);
  state = { restaurantId, dayKey, items: [] };
  writePersisted(restaurantId, dayKey, []);
  try {
    localStorage.setItem(
      `${STORAGE_KEY_V2}:seen:${restaurantId}`,
      new Date().toISOString(),
    );
  } catch {
    /* ignore */
  }
  emit();
}

export function liveActivityHasUnseen(restaurantId: string): boolean {
  if (typeof window === "undefined") return false;
  const latest = state.items[0]?.at;
  if (!latest) return false;
  try {
    const seen = localStorage.getItem(`${STORAGE_KEY_V2}:seen:${restaurantId}`);
    if (!seen) return true;
    return new Date(latest).getTime() > new Date(seen).getTime();
  } catch {
    return Boolean(latest);
  }
}
