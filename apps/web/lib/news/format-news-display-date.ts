import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { compareFeedItemsWithPinFirst } from "@/lib/feed-pin/feed-pin-types";

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
  return [...items].sort((a, b) =>
    compareFeedItemsWithPinFirst(a, b, (left, right) => {
      const diff = newsSortTimestamp(right) - newsSortTimestamp(left);
      if (diff !== 0) return diff;
      return right.id.localeCompare(left.id);
    }),
  );
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

const timelineMonthYearFmt = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});

const timelineMonthShortFmt = new Intl.DateTimeFormat("de-DE", {
  month: "short",
});

export function newsTimelineSameMonthYear(aIso: string, bIso: string): boolean {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function formatNewsTimelineDay(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit" });
}

export function formatNewsTimelineMonthShort(iso: string): string {
  return timelineMonthShortFmt.format(new Date(iso)).replace(/\.$/, "");
}

export function formatNewsTimelineMonthYear(iso: string): string {
  return timelineMonthYearFmt.format(new Date(iso));
}
