"use client";

import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export type ContactThreadCacheEntry = {
  messages: ContactMessageRow[];
  contactName: string;
  threadAvatarUrl: string | null;
  hasPhone: boolean;
  hasEmail: boolean;
  hasFacebookId: boolean;
  hasInstagramId: boolean;
  whatsappThreadChatId: string | null;
  cachedAt: number;
};

const SESSION_KEY_PREFIX = "gwada:contact-thread:";
const SESSION_INDEX_KEY = "gwada:contact-thread-index";
const SESSION_MAX_AGE_MS = 20 * 60 * 1000;
const SESSION_MAX_THREADS = 12;

const cache = new Map<string, ContactThreadCacheEntry>();

function cacheKey(restaurantId: string, contactId: string): string {
  return `${restaurantId}:${contactId}`;
}

function sessionStorageKey(key: string): string {
  return `${SESSION_KEY_PREFIX}${key}`;
}

type ThreadIndexEntry = { key: string; cachedAt: number };

function readThreadIndex(): ThreadIndexEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ThreadIndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeThreadIndex(entries: ThreadIndexEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

function touchThreadIndex(key: string): void {
  const now = Date.now();
  const merged = [{ key, cachedAt: now }, ...readThreadIndex().filter((e) => e.key !== key)];
  const next = merged.slice(0, SESSION_MAX_THREADS);
  const dropped = merged.slice(SESSION_MAX_THREADS);
  writeThreadIndex(next);
  for (const stale of dropped) {
    try {
      sessionStorage.removeItem(sessionStorageKey(stale.key));
    } catch {
      /* ignore */
    }
    cache.delete(stale.key);
  }
}

function readThreadFromSession(key: string): ContactThreadCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContactThreadCacheEntry;
    if (!Array.isArray(parsed.messages)) return null;
    if (Date.now() - parsed.cachedAt > SESSION_MAX_AGE_MS) {
      sessionStorage.removeItem(sessionStorageKey(key));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeThreadToSession(
  key: string,
  entry: ContactThreadCacheEntry,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(sessionStorageKey(key), JSON.stringify(entry));
    touchThreadIndex(key);
  } catch {
    /* ignore */
  }
}

function hydrateMemoryFromSession(key: string): ContactThreadCacheEntry | null {
  const fromSession = readThreadFromSession(key);
  if (!fromSession) return null;
  cache.set(key, fromSession);
  return fromSession;
}

export function peekContactThreadCache(
  restaurantId: string,
  contactId: string,
): ContactThreadCacheEntry | null {
  const key = cacheKey(restaurantId, contactId);
  const mem = cache.get(key);
  if (mem) return mem;
  return hydrateMemoryFromSession(key);
}

export function setContactThreadCache(
  restaurantId: string,
  contactId: string,
  entry: Omit<ContactThreadCacheEntry, "cachedAt">,
): void {
  const key = cacheKey(restaurantId, contactId);
  const full: ContactThreadCacheEntry = {
    ...entry,
    cachedAt: Date.now(),
  };
  cache.set(key, full);
  writeThreadToSession(key, full);
}

export function deleteContactThreadCacheEntry(
  restaurantId: string,
  contactId: string,
): void {
  const key = cacheKey(restaurantId, contactId);
  cache.delete(key);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(sessionStorageKey(key));
    } catch {
      /* ignore */
    }
  }
}

export function clearContactThreadCache(restaurantId?: string): void {
  if (!restaurantId) {
    cache.clear();
    if (typeof window !== "undefined") {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
          const key = sessionStorage.key(i);
          if (key?.startsWith(SESSION_KEY_PREFIX)) {
            sessionStorage.removeItem(key);
          }
        }
        sessionStorage.removeItem(SESSION_INDEX_KEY);
      } catch {
        /* ignore */
      }
    }
    return;
  }
  const prefix = `${restaurantId}:`;
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  if (typeof window !== "undefined") {
    try {
      for (const item of readThreadIndex()) {
        if (item.key.startsWith(prefix)) {
          sessionStorage.removeItem(sessionStorageKey(item.key));
        }
      }
      writeThreadIndex(
        readThreadIndex().filter((e) => !e.key.startsWith(prefix)),
      );
    } catch {
      /* ignore */
    }
  }
}
