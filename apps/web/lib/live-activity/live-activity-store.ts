"use client";

import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";

const STORAGE_KEY_V2 = "gwada:live-activity-feed:v2";
const STORAGE_KEY_V1 = "gwada:live-activity-feed:v1";
/** Im Speicher (nachladbar vom Server). */
const MAX_MEMORY_ITEMS = 500;
/** Nur Kurz-Cache in localStorage für schnelles Wiederöffnen. */
const MAX_PERSISTED_ITEMS = 80;

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

function persistKey(restaurantId: string): string {
  return `${STORAGE_KEY_V2}:${restaurantId}`;
}

function readPersisted(restaurantId: string): LiveActivityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(persistKey(restaurantId));
    if (raw) {
      const parsed = JSON.parse(raw) as LiveActivityItem[];
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_PERSISTED_ITEMS);
    }
    const legacy = sessionStorage.getItem(`${STORAGE_KEY_V1}:${restaurantId}`);
    if (!legacy) return [];
    const parsedLegacy = JSON.parse(legacy) as LiveActivityItem[];
    if (!Array.isArray(parsedLegacy)) return [];
    const slice = parsedLegacy.slice(0, MAX_PERSISTED_ITEMS);
    if (slice.length > 0) {
      writePersisted(restaurantId, slice);
    }
    return slice;
  } catch {
    return [];
  }
}

function writePersisted(restaurantId: string, items: LiveActivityItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      persistKey(restaurantId),
      JSON.stringify(items.slice(0, MAX_PERSISTED_ITEMS)),
    );
  } catch {
    /* ignore quota */
  }
}

function sortByAtDesc(items: LiveActivityItem[]): LiveActivityItem[] {
  return [...items].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

export function ensureLiveActivityRestaurant(restaurantId: string) {
  if (state.restaurantId === restaurantId) return;
  state = {
    restaurantId,
    items: readPersisted(restaurantId),
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

  const dup = state.items.find((row) => {
    if (row.id === next.id) return true;
    const dt = Math.abs(
      new Date(row.at).getTime() - new Date(next.at).getTime(),
    );
    if (
      row.title === next.title &&
      row.description === next.description &&
      dt < 2_000
    ) {
      return true;
    }
    // Optimistic Confirm + späteres Log/Backfill: gleicher Inhalt, andere ID.
    if (
      row.module &&
      row.module === next.module &&
      row.description &&
      row.description === next.description &&
      dt < 120_000
    ) {
      return true;
    }
    return false;
  });
  if (dup) {
    // Server-/Log-ID gewinnt gegen lokales pending.
    const preferNext =
      (next.id.startsWith("log:") ||
        next.id.startsWith("ref:") ||
        next.id.startsWith("evt:")) &&
      (dup.id.startsWith("local-") || dup.id.startsWith("local:"));
    if (!preferNext) return;
    state = {
      restaurantId,
      items: sortByAtDesc([
        next,
        ...state.items.filter((row) => row.id !== dup.id),
      ]).slice(0, MAX_MEMORY_ITEMS),
    };
    writePersisted(restaurantId, state.items);
    emit();
    return;
  }

  state = {
    restaurantId,
    items: sortByAtDesc([next, ...state.items]).slice(0, MAX_MEMORY_ITEMS),
  };
  writePersisted(restaurantId, state.items);
  emit();
}

/** Server-Seiten: ergänzen und vorhandene IDs mit aktuellen Feldern (z. B. href) aktualisieren. */
export function mergeLiveActivityItems(
  restaurantId: string,
  items: readonly LiveActivityItem[],
) {
  if (items.length === 0) return;
  ensureLiveActivityRestaurant(restaurantId);
  const byId = new Map(state.items.map((row) => [row.id, row]));
  for (const row of items) {
    byId.set(row.id, row);
  }

  // Optimistic local-* durch Server-Zeile ersetzen (gleiche description/module).
  for (const incoming of items) {
    if (!incoming.description || !incoming.module) continue;
    for (const [id, existing] of byId) {
      if (id === incoming.id) continue;
      if (!id.startsWith("local-") && !id.startsWith("local:")) continue;
      if (existing.module !== incoming.module) continue;
      if (existing.description !== incoming.description) continue;
      const dt = Math.abs(
        new Date(existing.at).getTime() - new Date(incoming.at).getTime(),
      );
      if (dt < 120_000) byId.delete(id);
    }
  }

  const merged = sortByAtDesc([...byId.values()]).slice(0, MAX_MEMORY_ITEMS);

  state = { restaurantId, items: merged };
  writePersisted(restaurantId, merged);
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
