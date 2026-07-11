/** Google-Bewertungen: Übersetzungs-Wrapper entfernen, Original bevorzugen. */
export function formatReviewCommentDisplay(comment: string | null | undefined): string | null {
  const raw = comment?.trim();
  if (!raw) return null;

  const originalMatch = raw.match(/\(Original\)\s*([\s\S]*)/i);
  if (originalMatch?.[1]?.trim()) {
    return originalMatch[1].trim();
  }

  let text = raw.replace(/^\(Translated by Google\)\s*/i, "").trim();
  text = text.replace(/\s*\(Translated by Google\)\s*/gi, " ").trim();
  return text || null;
}
