export function integrationSyncErrorMessage(code: string): string {
  switch (code) {
    case "google_not_connected":
      return "Google Business ist nicht verbunden.";
    case "facebook_not_connected":
      return "Facebook ist nicht verbunden.";
    case "google_location_missing":
    case "facebook_page_missing":
      return "Kein Standort bzw. keine Seite ausgewählt — unter Einstellungen → Integrationen verbinden.";
    case "no_opening_hours":
      return "Zuerst Öffnungszeiten speichern.";
    case "no_open_days":
      return "Keine geöffneten Wochentage zum Übertragen.";
    case "menu_empty":
      return "Keine aktiven Gerichte auf der Speisekarte.";
    case "kitchen_hours_disabled":
      return "Zuerst eigene Küchenzeiten aktivieren und speichern.";
    case "kitchen_hours_empty":
      return "Keine Küchenzeiten zum Übertragen.";
    default:
      if (code.startsWith("google_") || code.includes("Google")) {
        return `Google: ${code.replace(/^google_/, "")}`;
      }
      if (code.startsWith("facebook_")) {
        return `Facebook: ${code.replace(/^facebook_/, "")}`;
      }
      return "Übertragung fehlgeschlagen.";
  }
}
