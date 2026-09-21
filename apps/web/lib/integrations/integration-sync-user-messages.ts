export function integrationSyncErrorMessage(code: string): string {
  switch (code) {
    case "google_not_connected":
      return "Google Business ist nicht verbunden.";
    case "facebook_not_connected":
      return "Facebook ist nicht verbunden.";
    case "instagram_not_connected":
      return "Instagram ist nicht verbunden.";
    case "instagram_account_missing":
      return "Kein Instagram-Business-Konto verknüpft — unter Integrationen verbinden.";
    case "facebook_token_missing":
      return "Facebook-Zugang fehlt — unter Integrationen erneut verbinden.";
    case "restaurant_not_published":
      return "Restaurant ist noch nicht veröffentlicht — zuerst unter Einstellungen veröffentlichen.";
    case "enabled_required":
      return "Bitte Toggle erneut setzen.";
    case "restaurant_slug_missing":
      return "Restaurant-Slug fehlt — unter Einstellungen → Restaurant pflegen.";
    case "google_location_missing":
    case "facebook_page_missing":
      return "Kein Standort bzw. keine Seite ausgewählt — unter Einstellungen → Integrationen verbinden.";
    case "no_opening_hours":
      return "Zuerst Öffnungszeiten speichern.";
    case "no_open_days":
      return "Keine geöffneten Wochentage zum Übertragen.";
    case "menu_empty":
      return "Keine aktiven Gerichte in aktiven Kategorien.";
    case "google_food_menu_unsupported":
      return "Dieser Google-Standort kann keine Speisekarte führen.";
    case "google_token_missing":
      return "Google-Zugang abgelaufen — unter Integrationen erneut verbinden.";
    case "kitchen_hours_disabled":
      return "Zuerst eigene Küchenzeiten aktivieren und speichern.";
    case "kitchen_hours_empty":
      return "Keine Küchenzeiten zum Übertragen.";
    case "google_timeout":
      return "Google hat zu lange nicht geantwortet — bitte erneut versuchen.";
    case "facebook_timeout":
      return "Facebook hat zu lange nicht geantwortet — bitte erneut versuchen.";
    default: {
      const lower = code.toLowerCase();
      const looksGoogle =
        code.startsWith("google_") ||
        lower.includes("specialhours") ||
        lower.includes("special_hours") ||
        lower.includes("regularhours") ||
        lower.includes("mybusiness") ||
        /google\.type\.date/i.test(code) ||
        /invalid value at ['"]?special/i.test(code);

      if (looksGoogle) {
        if (
          /must be an object/i.test(code) ||
          /google\.type\.date/i.test(code) ||
          /invalid value at ['"]?special/i.test(code) ||
          /special.?hours/i.test(code)
        ) {
          return "Öffnungszeiten-Format abgelehnt — bitte Ausnahmen/Zeiten prüfen.";
        }
        return code.replace(/^google_/i, "").trim() || "Übertragung fehlgeschlagen.";
      }

      if (
        code.includes("pages_manage_metadata") ||
        code.includes("(#200)") ||
        /permission/i.test(code)
      ) {
        return "Facebook-Berechtigung fehlt — unter Integrationen Facebook erneut verbinden.";
      }
      if (
        code.startsWith("facebook_") ||
        /must be an object/i.test(code) ||
        /\bhours\b/i.test(code)
      ) {
        if (code.startsWith("facebook_")) {
          return code.replace(/^facebook_/, "");
        }
        return "Öffnungszeiten-Format abgelehnt — bitte Zeiten prüfen (kein ungültiges Format).";
      }
      return "Übertragung fehlgeschlagen.";
    }
  }
}
