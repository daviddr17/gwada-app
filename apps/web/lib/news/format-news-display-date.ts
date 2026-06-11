import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";

export function newsDisplayTimestamp(item: UnifiedNewsItem): string {
  if (item.status === "scheduled" && item.scheduledAt) {
    return item.scheduledAt;
  }
  return item.publishedAt ?? item.createdAt;
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
