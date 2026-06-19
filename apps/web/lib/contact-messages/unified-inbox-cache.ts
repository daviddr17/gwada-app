"use client";

import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export const GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT =
  "gwada:unified-inbox-cache-updated";

/** Erhöhen, wenn Listen-Format wechselt (z. B. DB-only statt Live-Merge). */
export const UNIFIED_INBOX_CACHE_VERSION = 3;

const SESSION_KEY_PREFIX = `gwada:unified-inbox:v${UNIFIED_INBOX_CACHE_VERSION}:`;
/** Überlebt Soft-Nav und Seiten-Reload in derselben Browser-Session. */
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

type CacheEntry = {
  conversations: ContactConversationPreview[];
  cachedAt: number;
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
    return parsed;
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
): void {
  const entry: CacheEntry = {
    conversations,
    cachedAt: Date.now(),
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

export function peekUnifiedInboxCacheAgeMs(restaurantId: string): number | null {
  const entry =
    cache.get(restaurantId) ?? hydrateMemoryFromSession(restaurantId);
  if (!entry) return null;
  return Date.now() - entry.cachedAt;
}

export type UnifiedInboxReadStatePatch = Pick<
  ContactConversationPreview,
  "is_unread" | "unread_count"
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
