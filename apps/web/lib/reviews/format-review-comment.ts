/**
 * Google (und ähnlich) liefert oft Original + maschinelle Übersetzung in einem
 * String. Marker und Reihenfolge variieren je nach Konto-Sprache.
 *
 * Ziel: nur den Originaltext anzeigen.
 */

/** `(Translated by Google)` und lokalisierte Varianten. */
const TRANSLATED_MARKER_RE =
  /\(\s*(?:Translated by Google(?: Translate)?|Übersetzt von Google|Von Google übersetzt|Traduit par Google|Traducido por Google|Tradotto da Google|Google tarafından çevrildi|Google\s*翻译|ترجمة Google)[^)]*\)/i;

/** `(Original)` und lokalisierte Varianten. */
const ORIGINAL_MARKER_RE =
  /\(\s*(?:Original(?: text)?|Ursprünglich|Originalsprache|Texte original|Texto original|Testo originale|Orijinal|原文|النص الأصلي)[^)]*\)/i;

function stripMarkers(text: string): string {
  return text
    .replace(TRANSLATED_MARKER_RE, " ")
    .replace(ORIGINAL_MARKER_RE, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

function splitOnFirst(
  text: string,
  re: RegExp,
): { before: string; after: string } | null {
  const match = re.exec(text);
  if (!match || match.index == null) return null;
  return {
    before: text.slice(0, match.index),
    after: text.slice(match.index + match[0].length),
  };
}

/** Google-Bewertungen: Übersetzungs-Wrapper entfernen, Original bevorzugen. */
export function formatReviewCommentDisplay(
  comment: string | null | undefined,
): string | null {
  const raw = comment?.trim();
  if (!raw) return null;

  // Format: … (Translated by Google) … (Original) <original>
  // oder nur (Original) <original>
  const originalSplit = splitOnFirst(raw, ORIGINAL_MARKER_RE);
  if (originalSplit) {
    const afterOriginal = stripMarkers(originalSplit.after);
    if (afterOriginal) return afterOriginal;
    const beforeOriginal = stripMarkers(originalSplit.before);
    if (beforeOriginal) return beforeOriginal;
  }

  // Format: <original> (Translated by Google) <translation>
  // oder (Translated by Google) <translation>
  const translatedSplit = splitOnFirst(raw, TRANSLATED_MARKER_RE);
  if (translatedSplit) {
    const beforeTranslated = stripMarkers(translatedSplit.before);
    if (beforeTranslated) return beforeTranslated;
    const afterTranslated = stripMarkers(translatedSplit.after);
    if (afterTranslated) return afterTranslated;
  }

  return stripMarkers(raw) || null;
}
