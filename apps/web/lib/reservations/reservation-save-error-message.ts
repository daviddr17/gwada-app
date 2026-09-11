/** Nutzertexte für Reservierungs-Speichern/Bestätigen (kein Roh-„Bad Gateway“). */

export function humanizeReservationSaveError(
  raw: string | undefined | null,
  fallback = "Speichern fehlgeschlagen. Bitte erneut versuchen.",
): string {
  const t = raw?.trim() ?? "";
  if (!t) return fallback;

  const m = t.toLowerCase();
  if (
    /bad gateway|502|503|gateway timeout|504|upstream|econnreset|etimedout|fetch failed|networkerror|failed to fetch|load failed/.test(
      m,
    )
  ) {
    return "Speichern gerade nicht möglich (kurze Verbindungsstörung). Bitte noch einmal tippen — die Reservierung wurde nicht doppelt angelegt.";
  }

  if (
    m.includes("reservations_quotation_id_unique") ||
    (m.includes("quotation_id") &&
      (m.includes("duplicate") || m.includes("unique")))
  ) {
    return "Dieses Angebot ist bereits einer anderen Reservierung zugeordnet.";
  }
  if (
    m.includes("reservations_invoice_id_unique") ||
    (m.includes("invoice_id") &&
      (m.includes("duplicate") || m.includes("unique")))
  ) {
    return "Diese Rechnung ist bereits einer anderen Reservierung zugeordnet.";
  }

  return t;
}
