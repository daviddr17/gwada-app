export function platformProfileErrorMessage(code: string): string {
  switch (code) {
    case "google_not_connected":
      return "Google Business ist nicht verbunden.";
    case "facebook_not_connected":
      return "Facebook ist nicht verbunden.";
    case "instagram_not_connected":
      return "Instagram ist nicht verbunden.";
    case "google_location_missing":
    case "facebook_page_missing":
    case "instagram_account_missing":
      return "Kein Standort bzw. keine Seite ausgewählt.";
    case "profile_empty":
      return "Mindestens ein Feld ausfüllen.";
    case "invalid_json":
      return "Ungültige Anfrage.";
    default:
      return code.trim() || "Profil konnte nicht geladen oder gespeichert werden.";
  }
}
