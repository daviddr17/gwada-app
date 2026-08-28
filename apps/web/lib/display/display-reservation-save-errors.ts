/** Anzeige-Texte für Display-Reservierungs-API-Fehler (POST/PATCH). */
import {
  guestContactRequirementErrorMessage,
  type GuestContactRequirementSettings,
} from "@/lib/reservations/guest-contact-requirements";

export const DISPLAY_RESERVATION_SAVE_ERRORS: Record<string, string> = {
  session_expired: "Sitzung abgelaufen — bitte erneut anmelden.",
  session_locked: "Bitte mit PIN anmelden.",
  module_forbidden: "Keine Berechtigung für Reservierungen.",
  device_not_paired: "Tablet nicht gekoppelt.",
  device_invalid: "Kopplung ungültig — bitte erneut koppeln.",
  not_found: "Reservierung nicht gefunden.",
  table_requires_confirmed:
    "Tischzuordnung nur bei Status „Bestätigt“ oder „Am Tisch“.",
  last_name_required: "Bitte einen Nachnamen eingeben.",
  invalid_request: "Eingaben unvollständig oder ungültig.",
  invalid_starts_at: "Ungültiges Datum oder Uhrzeit.",
  invalid_time_range: "Ende muss nach dem Beginn liegen.",
  status_missing: "Reservierungsstatus fehlt in der Datenbank.",
  server_misconfigured: "Server nicht konfiguriert.",
  create_failed: "Reservierung konnte nicht angelegt werden.",
  walk_in_disabled: "Walk-in ist für dieses Restaurant deaktiviert.",
  table_required: "Bitte einen Tisch wählen.",
};

export function displayReservationSaveErrorMessage(
  error?: string | null,
  fallback = "Speichern fehlgeschlagen.",
  guestContactSettings?: GuestContactRequirementSettings | null,
): string {
  if (!error?.trim()) return fallback;
  const key = error.trim();
  const contactMsg = guestContactRequirementErrorMessage(key, guestContactSettings);
  if (contactMsg) return contactMsg;
  if (DISPLAY_RESERVATION_SAVE_ERRORS[key]) {
    return DISPLAY_RESERVATION_SAVE_ERRORS[key];
  }
  if (key.includes("ends_at") || key.includes("reservations_ends_at")) {
    return DISPLAY_RESERVATION_SAVE_ERRORS.invalid_time_range;
  }
  return key.length <= 120 ? key : fallback;
}
