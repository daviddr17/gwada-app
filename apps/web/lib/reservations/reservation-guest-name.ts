/** Vorname beim Speichern — leer bleibt leer (kein „Gast“-Default). */
export function normalizeReservationGuestFirstName(value: string): string {
  return value.trim();
}

/** Nachname beim Speichern (Pflicht wird in Formularen/API geprüft). */
export function normalizeReservationGuestLastName(value: string): string {
  return value.trim();
}

/** Optionaler Firmenname — leer → null. */
export function normalizeReservationGuestCompany(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

/** Formular: alten „Gast“-Platzhalter aus der DB als leer anzeigen. */
export function reservationGuestFirstNameForForm(value: string): string {
  const trimmed = value.trim();
  return trimmed === "Gast" ? "" : trimmed;
}

/** Anzeige, wenn beide Namensfelder leer wären. Optional mit Firmenname. */
export function reservationGuestDisplayName(
  firstName: string,
  lastName: string,
  company?: string | null,
): string {
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const firm = company?.trim() ?? "";
  if (name && firm) return `${name} · ${firm}`;
  return name || firm || "Gast";
}
