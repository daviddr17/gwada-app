/** Nutzerfreundliche TripAdvisor-Fehlertexte (Client + Server). */

const TRIPADVISOR_USER_MESSAGES: Record<string, string> = {
  tripadvisor_rate_limit:
    "TripAdvisor-API-Limit erreicht. Bitte in ein paar Minuten erneut versuchen.",
  tripadvisor_403:
    "Zugriff verweigert — API-Key oder Location-ID in Superadmin bzw. Einstellungen prüfen.",
  tripadvisor_allowlist_denied:
    "Standort-Lookup ok, aber Content (Bewertungen/Fotos) braucht Terra-Allowlist: Location in Superadmin → TripAdvisor freischalten oder API-Key-Rechte prüfen.",
  tripadvisor_401: "TripAdvisor-API-Key ungültig oder abgelaufen.",
  tripadvisor_disabled: "TripAdvisor ist auf der Plattform noch nicht freigeschaltet.",
  tripadvisor_api_key_missing: "TripAdvisor-API-Key fehlt in Superadmin → Integrationen.",
  tripadvisor_location_invalid: "Ungültige Location-ID — nur Zahlen erlaubt.",
  tripadvisor_not_connected: "TripAdvisor ist noch nicht verbunden.",
  tripadvisor_location_missing: "Location-ID fehlt.",
};

export function normalizeTripadvisorErrorCode(error: string, status?: number): string {
  const trimmed = error.trim();
  if (status === 429 || /rate\s*limit/i.test(trimmed)) {
    return "tripadvisor_rate_limit";
  }
  if (
    /allowlist/i.test(trimmed) ||
    trimmed === "tripadvisor_allowlist_denied"
  ) {
    return "tripadvisor_allowlist_denied";
  }
  if (status === 403) return "tripadvisor_403";
  if (status === 401) return "tripadvisor_401";
  if (trimmed.startsWith("tripadvisor_")) return trimmed;
  return trimmed;
}

export function tripadvisorErrorMessageForUser(error: string, status?: number): string {
  const code = normalizeTripadvisorErrorCode(error, status);
  return (
    TRIPADVISOR_USER_MESSAGES[code] ??
    (code.startsWith("tripadvisor_")
      ? "TripAdvisor-Verbindung fehlgeschlagen."
      : code)
  );
}
