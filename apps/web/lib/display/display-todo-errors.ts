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
    default:
      return "Aktion fehlgeschlagen.";
  }
}
