import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";

/** Silent refresh: kein Re-Render wenn Feed unverändert. */
export function sameNewsFeedItems(
  prev: UnifiedNewsItem[],
  next: UnifiedNewsItem[],
): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (!b || a.id !== b.id) return false;
    if (a.publishedAt !== b.publishedAt) return false;
    if (a.isPinned !== b.isPinned) return false;
    if (a.status !== b.status) return false;
  }
  return true;
}
