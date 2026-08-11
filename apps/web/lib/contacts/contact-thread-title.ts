/**
 * Thread-/Listen-Titel für Kontakte — generische Platzhalter erkennen und
 * den besten verfügbaren Namen wählen (Person → Firma → E-Mail → Absender).
 */

const GENERIC_THREAD_TITLES = new Set([
  "kontakt",
  "unbenannt",
  "e-mail",
  "email",
  "whatsapp",
  "messenger",
  "instagram",
  "chat",
  "gast",
]);

export function isGenericContactThreadTitle(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  return GENERIC_THREAD_TITLES.has(t.toLocaleLowerCase("de-DE"));
}

/** Ersten nicht-generischen Kandidaten, sonst ersten nicht-leeren, sonst Fallback. */
export function pickContactThreadTitle(
  ...candidates: Array<string | null | undefined>
): string {
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !isGenericContactThreadTitle(t)) return t;
  }
  for (const c of candidates) {
    const t = c?.trim();
    if (t) return t;
  }
  return "Kontakt";
}
