/** Vorname beim Speichern — leer bleibt leer (kein „Gast“-Default). */
export function normalizeReservationGuestFirstName(value: string): string {
  return value.trim();
}

/** Nachname beim Speichern (Pflicht wird in Formularen/API geprüft). */
export function normalizeReservationGuestLastName(value: string): string {
  return value.trim();
}

/** Formular: alten „Gast“-Platzhalter aus der DB als leer anzeigen. */
export function reservationGuestFirstNameForForm(value: string): string {
  const trimmed = value.trim();
  return trimmed === "Gast" ? "" : trimmed;
}

/** Anzeige, wenn beide Namensfelder leer wären. */
export function reservationGuestDisplayName(
  firstName: string,
  lastName: string,
): string {
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  return name || "Gast";
}
