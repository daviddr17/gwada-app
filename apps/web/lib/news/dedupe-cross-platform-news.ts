import { stripMarkdownBold } from "@/lib/changelog/changelog-entry-normalize";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";

const PLATFORM_KEEP_PRIORITY: NewsPlatform[] = [
  "gwada",
  "instagram",
  "facebook",
  "google_business",
  "whatsapp_channel",
];

function normalizeNewsDedupeKey(item: UnifiedNewsItem): string | null {
  const body = stripMarkdownBold(item.body)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const title = stripMarkdownBold(item.title ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const textKey = [title, body].filter(Boolean).join("|");
  if (textKey.length >= 12) return `text:${textKey}`;

  const mediaUrl = item.media[0]?.url?.trim() ?? item.media[0]?.thumbUrl?.trim();
  if (mediaUrl) return `media:${mediaUrl}`;

  return textKey.length > 0 ? `text:${textKey}` : null;
}

function platformRank(platform: NewsPlatform): number {
  const idx = PLATFORM_KEEP_PRIORITY.indexOf(platform);
  return idx === -1 ? PLATFORM_KEEP_PRIORITY.length : idx;
}

function pickPreferredItem(a: UnifiedNewsItem, b: UnifiedNewsItem): UnifiedNewsItem {
  const rankDiff = platformRank(a.platform) - platformRank(b.platform);
  if (rankDiff !== 0) return rankDiff < 0 ? a : b;

  const aPinned = a.isPinned ? 1 : 0;
  const bPinned = b.isPinned ? 1 : 0;
  if (aPinned !== bPinned) return aPinned > bPinned ? a : b;

  const aTime = new Date(a.publishedAt ?? a.createdAt).getTime();
  const bTime = new Date(b.publishedAt ?? b.createdAt).getTime();
  return aTime >= bTime ? a : b;
}

/** „Alle“-Feed: gleicher Cross-Post (Meta FB+IG) nur einmal anzeigen. */
export function dedupeCrossPlatformNewsItems(
  items: UnifiedNewsItem[],
): UnifiedNewsItem[] {
  const byKey = new Map<string, UnifiedNewsItem>();

  for (const item of items) {
    const key = normalizeNewsDedupeKey(item);
    if (!key) {
      byKey.set(`id:${item.id}`, item);
      continue;
    }
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferredItem(existing, item) : item);
  }

  return items.filter((item) => {
    const key = normalizeNewsDedupeKey(item);
    if (!key) return true;
    return byKey.get(key)?.id === item.id;
  });
}
