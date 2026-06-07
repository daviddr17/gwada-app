const displayNames = new Intl.DisplayNames(["de"], { type: "language" });

/** Locale-Code (z. B. `de`, `de-DE`) → lesbarer Name auf Deutsch. */
export function formatLocaleLabel(code: string): string {
  const t = code.trim();
  if (!t) return "—";
  try {
    return displayNames.of(t) ?? t;
  } catch {
    return t;
  }
}
