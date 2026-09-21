/** Nutzerfreundliche Meldungen für Bewertungen-API-Fehler (kein „Bad Gateway“ im Toast). */

export function humanizeReviewsApiError(
  raw: string | undefined | null,
  fallback = "Bewertungen konnten nicht geladen werden.",
): string {
  const t = raw?.trim() ?? "";
  if (!t) return fallback;

  if (
    /bad gateway|502|503|upstream_unreachable|supabase_upstream|service unavailable|gateway timeout|econnreset|etimedout/i.test(
      t,
    )
  ) {
    return "Der Dienst ist gerade nicht erreichbar. Bitte in ein paar Sekunden erneut versuchen.";
  }

  if (t === "forbidden") {
    return "Keine Berechtigung für Bewertungen.";
  }
  if (t === "permission_check_failed") {
    return "Berechtigung konnte nicht geprüft werden.";
  }
  if (t === "invalid_platform") {
    return "Unbekannte Plattform.";
  }
  if (t === "network_error" || t === "mark_read_failed") {
    return "Netzwerkfehler. Bitte erneut versuchen.";
  }

  return t;
}
