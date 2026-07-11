import { stripMarkdownBold } from "@/lib/changelog/changelog-entry-normalize";

/** Zeichenlimit für Karten-Vorschau — voller Text bleibt im Drawer. */
export const NEWS_CARD_PREVIEW_MAX_CHARS = 220;

export function newsCardPreviewBody(body: string): string {
  const stripped = stripMarkdownBold(body).trim();
  if (stripped.length <= NEWS_CARD_PREVIEW_MAX_CHARS) return stripped;
  return `${stripped.slice(0, NEWS_CARD_PREVIEW_MAX_CHARS).trimEnd()}…`;
}

export function newsBodyNeedsExpand(body: string): boolean {
  return stripMarkdownBold(body).trim().length > NEWS_CARD_PREVIEW_MAX_CHARS;
}
