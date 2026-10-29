/**
 * Pure text helpers for premium social layouts (unit-testable).
 */

/** Headline: Titel, sonst erste Caption-Zeile — nie Galerie-Platzhalter. */
export function layoutHeadline(
  title: string | null | undefined,
  captionLine: string,
  fallback: string,
): string {
  const t = title?.trim();
  if (
    t &&
    t.toLowerCase() !== "galerie" &&
    t.toLowerCase() !== "gallery" &&
    t.toLowerCase() !== "foto"
  ) {
    return t.slice(0, 48);
  }
  const fromCaption = captionLine.split(/[.!?\n]/)[0]?.trim();
  if (fromCaption && fromCaption.length >= 3) return fromCaption.slice(0, 48);
  return fallback.slice(0, 48);
}

/** Word-wrap für Overlay-Zeilen (Serif-Headlines inkl.). */
export function wrapLayoutLines(
  text: string,
  maxChars: number,
  maxLines: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

/** Kurze Supporting-Line ohne CTA/Hashtags. */
export function layoutSupportingLine(
  captionLine: string,
  headline: string,
): string {
  const raw = captionLine.replace(/\s+/g, " ").trim();
  if (!raw) return "";
  // Drop hashtag / CTA-looking trailing bits
  const cleaned = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^#/.test(l))
    .join(" ");
  if (!cleaned) return "";
  const lowerHead = headline.toLowerCase();
  if (cleaned.toLowerCase().startsWith(lowerHead)) {
    const rest = cleaned.slice(headline.length).replace(/^[\s—–\-:.,]+/, "");
    return rest.slice(0, 90);
  }
  return cleaned.slice(0, 90);
}
