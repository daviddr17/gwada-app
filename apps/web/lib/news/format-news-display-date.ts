import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";

/** Canonical timestamp for display and feed sort (newest first). */
export function newsDisplayTimestamp(item: UnifiedNewsItem): string {
  if (item.status === "scheduled" && item.scheduledAt) {
    return item.scheduledAt;
  }
  return item.publishedAt || item.createdAt || "";
}

export function newsSortTimestamp(item: UnifiedNewsItem): number {
  const iso = newsDisplayTimestamp(item);
  const ts = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ts) ? ts : 0;
}

/** Newest first; stable tie-break on id. */
export function sortNewsItemsByDate(items: UnifiedNewsItem[]): UnifiedNewsItem[] {
  return [...items].sort((a, b) => {
    const diff = newsSortTimestamp(b) - newsSortTimestamp(a);
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });
}

export function formatNewsCardDate(item: UnifiedNewsItem): string {
  const iso = newsDisplayTimestamp(item);
  const formatted = new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (item.status === "scheduled" && item.scheduledAt) {
    return `Geplant · ${formatted}`;
  }
  return formatted;
}

export function formatNewsDetailDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
