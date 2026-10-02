"use client";

import {
  liveActivityPayloadVisibleToViewer,
  type LiveActivityFeedViewer,
} from "@/lib/live-activity/live-activity-feed-access";
import { preferAccountingFeedTitle } from "@/lib/live-activity/live-activity-accounting-uploader";
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
let accessViewer: LiveActivityFeedViewer | null = null;
const listeners = new Set<Listener>();

const PERSONAL_ROW_MODULES = new Set([
  "staff_contract_signed",
  "staff_document_assigned",
  "staff_permissions_granted",
]);

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

function isAccountingLiveModule(module: string | undefined): boolean {
  return (
    module === "accounting_voucher" ||
    module === "accounting_invoice" ||
    module === "accounting_quotation"
  );
}

/** Realtime und Feed-API schreiben dieselbe Event-UUID unterschiedlich groß. */
function canonicalLiveActivityId(id: string): string {
  const match =
    /^evt:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
      id.trim(),
    );
  return match ? `evt:${match[1].toLowerCase()}` : id;
}

function sortByAtDesc(items: LiveActivityItem[]): LiveActivityItem[] {
  return [...items].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

export function ensureLiveActivityRestaurant(restaurantId: string) {
  if (state.restaurantId === restaurantId) return;
  accessViewer = null;
  state = {
    restaurantId,
    items: readPersisted(restaurantId),
  };
  emit();
}

function moduleAllowed(module: string | undefined): boolean {
  if (!accessViewer || !module) return true;
  return accessViewer.modules.includes(
    module as LiveActivityFeedViewer["modules"][number],
  );
}

function keepCachedItem(row: LiveActivityItem): boolean {
  if (!moduleAllowed(row.module)) return false;
  if (!accessViewer || accessViewer.unrestricted || !row.module) return true;
  if (PERSONAL_ROW_MODULES.has(row.module)) return false;
  if (
    accessViewer.shiftScope === "own" &&
    (row.module === "staff_shift_start" || row.module === "staff_shift_end")
  ) {
    return false;
  }
  return true;
}

/** Rechte aus der Feed-API. Cache ohne diese Module wird verworfen. */
export function setLiveActivityAccess(
  restaurantId: string,
  viewer: LiveActivityFeedViewer,
) {
  ensureLiveActivityRestaurant(restaurantId);
  accessViewer = viewer;
  const next = state.items.filter(keepCachedItem);
  if (next.length === state.items.length) return;
  state = { restaurantId, items: next };
  writePersisted(restaurantId, next);
  emit();
}

export function isLiveActivityInsertVisible(
  module: string,
  payload: Record<string, unknown>,
): boolean {
  if (!accessViewer) return true;
  if (!moduleAllowed(module)) return false;
  return liveActivityPayloadVisibleToViewer({
    module,
    payload,
    userId: accessViewer.userId,
    viewerStaffId: accessViewer.viewerStaffId,
    shiftScope: accessViewer.shiftScope,
    unrestricted: accessViewer.unrestricted,
  });
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
  if (!moduleAllowed(item.module)) return;
  const next: LiveActivityItem = {
    id: canonicalLiveActivityId(
      item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ),
    kind: item.kind,
    module: item.module,
    title: item.title,
    description: item.description ?? null,
    href: item.href ?? null,
    at: item.at ?? new Date().toISOString(),
    ...(item.purchaseOrderCompletion
      ? { purchaseOrderCompletion: item.purchaseOrderCompletion }
      : {}),
  };

  const dup = state.items.find((row) => {
    if (canonicalLiveActivityId(row.id) === next.id) return true;
    if (
      row.purchaseOrderCompletion?.orderId &&
      next.purchaseOrderCompletion?.orderId &&
      row.purchaseOrderCompletion.orderId !==
        next.purchaseOrderCompletion.orderId
    ) {
      return false;
    }
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
    const sameEvent = canonicalLiveActivityId(dup.id) === next.id;
    const upgradeTitle =
      sameEvent &&
      isAccountingLiveModule(next.module) &&
      preferAccountingFeedTitle(dup.title, next.title) !== dup.title;
    // Server-/Log-ID gewinnt gegen lokales pending.
    const preferServerId =
      (next.id.startsWith("log:") ||
        next.id.startsWith("ref:") ||
        next.id.startsWith("evt:")) &&
      (dup.id.startsWith("local-") || dup.id.startsWith("local:"));
    if (!upgradeTitle && !preferServerId) return;
    const title = isAccountingLiveModule(next.module)
      ? preferAccountingFeedTitle(dup.title, next.title)
      : next.title;
    state = {
      restaurantId,
      items: sortByAtDesc([
        {
          ...next,
          id: preferServerId ? next.id : canonicalLiveActivityId(dup.id),
          title,
        },
        ...state.items.filter(
          (row) => canonicalLiveActivityId(row.id) !== canonicalLiveActivityId(dup.id),
        ),
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
  const byId = new Map<string, LiveActivityItem>();
  for (const row of state.items) {
    const id = canonicalLiveActivityId(row.id);
    byId.set(id, { ...row, id });
  }
  for (const row of items) {
    if (!moduleAllowed(row.module)) continue;
    const id = canonicalLiveActivityId(row.id);
    const existing = byId.get(id);
    const title =
      existing && isAccountingLiveModule(row.module)
        ? preferAccountingFeedTitle(existing.title, row.title)
        : row.title;
    byId.set(id, { ...row, id, title });
  }

  // Optimistic local-* durch Server-Zeile ersetzen (gleiche description/module).
  for (const incoming of items) {
    if (!incoming.description || !incoming.module) continue;
    for (const [id, existing] of byId) {
      if (id === canonicalLiveActivityId(incoming.id)) continue;
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
