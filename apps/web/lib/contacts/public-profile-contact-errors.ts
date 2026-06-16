export const PUBLIC_PROFILE_CONTACT_ERROR_DE: Record<string, string> = {
  invalid_slug: "Ungültige Adresse.",
  not_found: "Restaurant nicht gefunden.",
  server_misconfigured: "Der Dienst ist vorübergehend nicht verfügbar.",
  invalid_request: "Bitte alle Pflichtfelder ausfüllen.",
  contact_required: "E-Mail oder Telefonnummer ist erforderlich.",
  invalid_email: "Bitte eine gültige E-Mail-Adresse eingeben.",
  invalid_phone: "Bitte eine gültige Telefonnummer eingeben.",
  message_required: "Bitte eine Nachricht eingeben.",
  message_too_long: "Die Nachricht ist zu lang (max. 8000 Zeichen).",
  contact_create_failed: "Nachricht konnte nicht zugeordnet werden.",
  message_send_failed: "Nachricht konnte nicht gesendet werden.",
  db_error: "Ein Fehler ist aufgetreten. Bitte später erneut versuchen.",
};

export function publicProfileContactErrorMessage(code: string): string {
  return PUBLIC_PROFILE_CONTACT_ERROR_DE[code] ?? PUBLIC_PROFILE_CONTACT_ERROR_DE.invalid_request!;
}
