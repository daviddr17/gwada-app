"use client";

import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";

const STORAGE_KEY = "gwada:live-activity-feed:v1";
const MAX_ITEMS = 80;

type StoreState = {
  restaurantId: string | null;
  items: LiveActivityItem[];
};

type Listener = () => void;

let state: StoreState = { restaurantId: null, items: [] };
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function readSession(restaurantId: string): LiveActivityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}:${restaurantId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LiveActivityItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function writeSession(restaurantId: string, items: LiveActivityItem[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${STORAGE_KEY}:${restaurantId}`,
      JSON.stringify(items.slice(0, MAX_ITEMS)),
    );
  } catch {
    /* ignore quota */
  }
}

export function ensureLiveActivityRestaurant(restaurantId: string) {
  if (state.restaurantId === restaurantId) return;
  state = {
    restaurantId,
    items: readSession(restaurantId),
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
) {
  ensureLiveActivityRestaurant(restaurantId);
  const next: LiveActivityItem = {
    id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: item.kind,
    module: item.module,
    title: item.title,
    description: item.description ?? null,
    href: item.href ?? null,
    at: item.at ?? new Date().toISOString(),
  };

  // Dedup: gleiche id oder gleicher Titel+Beschreibung in den letzten 2s
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
    items: [next, ...state.items].slice(0, MAX_ITEMS),
  };
  writeSession(restaurantId, state.items);
  emit();
}

export function clearLiveActivitySeenDot(restaurantId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${STORAGE_KEY}:seen:${restaurantId}`,
      state.items[0]?.at ?? new Date().toISOString(),
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
    const seen = sessionStorage.getItem(`${STORAGE_KEY}:seen:${restaurantId}`);
    if (!seen) return true;
    return new Date(latest).getTime() > new Date(seen).getTime();
  } catch {
    return Boolean(latest);
  }
}
