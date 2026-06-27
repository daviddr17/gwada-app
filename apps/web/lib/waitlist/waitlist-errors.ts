export function waitlistErrorMessage(error: string | undefined): string {
  switch (error) {
    case "name_required":
      return "Bitte Vor- und Nachname eingeben.";
    case "invalid_email":
      return "Bitte eine gültige E-Mail-Adresse eingeben.";
    case "note_too_long":
      return "Die Notiz ist zu lang (max. 2000 Zeichen).";
    case "server_misconfigured":
      return "Der Dienst ist gerade nicht verfügbar. Bitte später erneut versuchen.";
    default:
      return "Eintrag fehlgeschlagen. Bitte später erneut versuchen.";
  }
}
