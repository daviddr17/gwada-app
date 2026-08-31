"use client";

import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export const GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT =
  "gwada:unified-inbox-cache-updated";

/** Erhöhen, wenn Listen-Format wechselt (z. B. DB-only statt Live-Merge). */
export const UNIFIED_INBOX_CACHE_VERSION = 5;

const SESSION_KEY_PREFIX = `gwada:unified-inbox:v${UNIFIED_INBOX_CACHE_VERSION}:`;
/** Überlebt Soft-Nav und Seiten-Reload in derselben Browser-Session. */
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * SWR-Fenster — bei Cache-Hit unter diesem Alter kein Force-Refetch beim Öffnen.
 * Align mit `module-data-cache-policy` unifiedInbox.staleTimeMs.
 */
export const UNIFIED_INBOX_STALE_MS = 5 * 60 * 1000;

type CacheEntry = {
  conversations: ContactConversationPreview[];
  cachedAt: number;
  /** true nach vollem fetchUnifiedInboxConversations — nicht nach reinem Realtime-Seed. */
  complete: boolean;
};

const cache = new Map<string, CacheEntry>();

function sessionKey(restaurantId: string): string {
  return `${SESSION_KEY_PREFIX}${restaurantId}`;
}

function readInboxFromSession(restaurantId: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!Array.isArray(parsed.conversations)) return null;
    if (Date.now() - parsed.cachedAt > SESSION_MAX_AGE_MS) {
      sessionStorage.removeItem(sessionKey(restaurantId));
      return null;
    }
    return {
      conversations: parsed.conversations,
      cachedAt: parsed.cachedAt,
      complete: parsed.complete === true,
    };
  } catch {
    return null;
  }
}

function writeInboxToSession(restaurantId: string, entry: CacheEntry): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(sessionKey(restaurantId), JSON.stringify(entry));
  } catch {
    /* Quota — In-Memory reicht */
  }
}

function hydrateMemoryFromSession(restaurantId: string): CacheEntry | null {
  const fromSession = readInboxFromSession(restaurantId);
  if (!fromSession) return null;
  cache.set(restaurantId, fromSession);
  return fromSession;
}

export function setUnifiedInboxCache(
  restaurantId: string,
  conversations: ContactConversationPreview[],
  options?: { complete?: boolean },
): void {
  const prev = cache.get(restaurantId) ?? hydrateMemoryFromSession(restaurantId);
  const entry: CacheEntry = {
    conversations,
    cachedAt: Date.now(),
    complete: options?.complete ?? prev?.complete ?? false,
  };
  cache.set(restaurantId, entry);
  writeInboxToSession(restaurantId, entry);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT, {
        detail: { restaurantId },
      }),
    );
  }
}

export function peekUnifiedInboxCache(
  restaurantId: string,
): ContactConversationPreview[] | null {
  const mem = cache.get(restaurantId);
  if (mem) return mem.conversations;
  const hydrated = hydrateMemoryFromSession(restaurantId);
  return hydrated?.conversations ?? null;
}

/** Nur nach vollem Inbox-Fetch — sonst unterzählt Realtime-Seed die Glocke. */
export function peekCompleteUnifiedInboxCache(
  restaurantId: string,
): ContactConversationPreview[] | null {
  const entry = cache.get(restaurantId) ?? hydrateMemoryFromSession(restaurantId);
  if (!entry?.complete) return null;
  return entry.conversations;
}

export function peekUnifiedInboxCacheAgeMs(restaurantId: string): number | null {
  const entry =
    cache.get(restaurantId) ?? hydrateMemoryFromSession(restaurantId);
  if (!entry) return null;
  return Date.now() - entry.cachedAt;
}

/** Cache vorhanden und jünger als {@link UNIFIED_INBOX_STALE_MS}. */
export function isUnifiedInboxCacheFresh(restaurantId: string): boolean {
  const age = peekUnifiedInboxCacheAgeMs(restaurantId);
  return age != null && age < UNIFIED_INBOX_STALE_MS;
}

export type UnifiedInboxReadStatePatch = Pick<
  ContactConversationPreview,
  "is_unread" | "unread_count" | "unread_hint"
> & {
  whatsapp_unread_count?: number;
  email_unread_count?: number;
};

/** Lesestatus einer Zeile im Cache anpassen (z. B. nach „gelesen“ / „ungelesen“). */
export function patchUnifiedInboxCacheConversation(
  restaurantId: string,
  contactId: string,
  patch: UnifiedInboxReadStatePatch,
): void {
  const entry = cache.get(restaurantId) ?? hydrateMemoryFromSession(restaurantId);
  if (!entry) return;

  const conversations = entry.conversations.map((c) =>
    c.contact_id === contactId ? { ...c, ...patch } : c,
  );

  setUnifiedInboxCache(restaurantId, conversations);
}

/** Alle Zeilen im Inbox-Cache als gelesen (Glocke „alle gelesen“) — kein Cache-Clear. */
export function markAllUnifiedInboxCacheRead(restaurantId: string): void {
  const entry = cache.get(restaurantId) ?? hydrateMemoryFromSession(restaurantId);
  if (!entry) return;

  const conversations = entry.conversations.map((c) => ({
    ...c,
    is_unread: false,
    unread_count: 0,
    whatsapp_unread_count: 0,
    email_unread_count: 0,
    unread_hint: null,
  }));

  setUnifiedInboxCache(restaurantId, conversations);
}

export function clearUnifiedInboxCache(restaurantId?: string): void {
  if (restaurantId) {
    cache.delete(restaurantId);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(sessionKey(restaurantId));
      } catch {
        /* ignore */
      }
    }
    return;
  }
  cache.clear();
  if (typeof window !== "undefined") {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(SESSION_KEY_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      /* ignore */
    }
  }
}
