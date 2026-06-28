export function displayTodoErrorMessage(error: string | undefined): string {
  switch (error) {
    case "capture_required":
      return "Bitte Erfassungswert angeben.";
    case "corrective_action_required":
      return "Korrekturmaßnahme bei Abweichung erforderlich.";
    case "reason_required":
      return "Bitte einen Grund angeben.";
    case "reopen_not_allowed":
      return "Zurücknehmen ist für diese Checkliste nicht erlaubt.";
    case "not_found":
      return "Checkliste nicht gefunden.";
    case "not_assigned":
      return "Diese Checkliste ist dir nicht zugewiesen.";
    case "capture_invalid":
      return "Erfassung ungültig — bitte prüfen und erneut versuchen.";
    case "session_expired":
    case "session_invalid":
    case "session_locked":
      return "Anmeldung abgelaufen — bitte erneut PIN eingeben.";
    case "invalid_response":
      return "Server-Antwort ungültig — bitte erneut versuchen.";
    case "completion_save_failed":
    case "completion_not_persisted":
    case "completion_verify_failed":
      return "Erledigung konnte nicht gespeichert werden.";
    case "PGRST204":
      return "Datenbank-Schema wird aktualisiert — bitte in 1–2 Minuten erneut versuchen.";
    default:
      if (error && error.length > 0 && error.length < 120) {
        return `Aktion fehlgeschlagen (${error}).`;
      }
      return "Aktion fehlgeschlagen.";
  }
}
