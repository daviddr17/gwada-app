import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

/** Erste Seite im Chat — danach „Ältere Nachrichten anzeigen“. */
export const CONTACT_THREAD_PAGE_SIZE = 10;

/** Max. Nachrichten pro Quellen-Request (WAHA/DB/IMAP-Fenster/Meta). */
export const CONTACT_THREAD_SOURCE_FETCH_MAX = 30;

/** Fenster pro Quelle beim Merge (verknüpfte Kontakte). */
export function perSourceFetchLimit(
  pageLimit: number,
  before?: string | null,
): number {
  const slack = before ? 15 : 10;
  return Math.min(CONTACT_THREAD_SOURCE_FETCH_MAX, pageLimit + slack);
}

/** WAHA-API: limit-Parameter — WAHA liefert exakt so viele (neueste zuerst). */
export function wahaApiFetchLimit(
  pageLimit: number,
  before?: string | null,
): number {
  const slack = before ? 20 : 10;
  return Math.min(CONTACT_THREAD_SOURCE_FETCH_MAX, pageLimit + slack);
}

/** Meta Graph: Nachrichten pro Request. */
export function metaApiFetchLimit(
  pageLimit: number,
  before?: string | null,
): number {
  const slack = before ? 15 : 10;
  return Math.min(CONTACT_THREAD_SOURCE_FETCH_MAX, pageLimit + slack);
}

export function mergeThreadHasMore(
  pageHasMore: boolean,
  ...sourceHasMore: boolean[]
): boolean {
  return pageHasMore || sourceHasMore.some(Boolean);
}

export function compareContactMessagesChronological(
  a: ContactMessageRow,
  b: ContactMessageRow,
): number {
  const byTime = a.created_at.localeCompare(b.created_at);
  if (byTime !== 0) return byTime;
  return a.id.localeCompare(b.id);
}

export function sortContactMessagesChronological(
  messages: ContactMessageRow[],
): ContactMessageRow[] {
  return [...messages].sort(compareContactMessagesChronological);
}

/** Neueste `limit` Nachrichten; mit `before` die älteren davor. */
export function paginateContactThreadMessages(
  messages: ContactMessageRow[],
  limit: number,
  before?: string | null,
): {
  page: ContactMessageRow[];
  hasMore: boolean;
  oldestCursor: string | null;
} {
  const sorted = sortContactMessagesChronological(messages);
  const pool = before
    ? sorted.filter((m) => m.created_at < before)
    : sorted;

  const hasMore = pool.length > limit;
  const page = pool.slice(-limit);
  const oldestCursor = page.length > 0 ? page[0]!.created_at : null;

  return { page, hasMore, oldestCursor };
}

export function dedupeContactMessagesById(
  messages: ContactMessageRow[],
): ContactMessageRow[] {
  const seen = new Set<string>();
  const out: ContactMessageRow[] = [];
  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return sortContactMessagesChronological(out);
}
