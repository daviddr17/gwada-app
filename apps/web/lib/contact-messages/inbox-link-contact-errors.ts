/** Nutzer-Hinweise für Inbox-Thread ↔ Kontakt Verknüpfung. */
export function inboxLinkContactErrorMessage(error: string | undefined): string {
  switch (error) {
    case "contact_not_found":
      return "Kontakt nicht gefunden.";
    case "invalid_meta_contact":
    case "invalid_waha_contact":
    case "invalid_email_contact":
      return "Ungültiger Chat — bitte Seite neu laden.";
    case "email_on_other_contact":
      return "Diese E-Mail-Adresse ist bereits bei einem anderen Kontakt hinterlegt.";
    case "sender_already_linked":
      return "Dieser Messenger-/Instagram-Chat ist bereits einem anderen Kontakt zugeordnet.";
    case "meta_not_connected":
      return "Facebook/Instagram ist nicht verbunden.";
    case "imap_not_configured":
      return "E-Mail-Konto ist nicht verbunden.";
    case "empty_sender_id":
      return "Keine gültige Meta-Sender-ID für diesen Chat.";
    default:
      if (!error?.trim()) {
        return "Verknüpfung mit bestehendem Kontakt fehlgeschlagen.";
      }
      if (error.includes("contact_messaging_ids_restaurant_platform_sender")) {
        return "Dieser Messenger-/Instagram-Chat ist bereits einem anderen Kontakt zugeordnet.";
      }
      if (error.includes("contact_emails_restaurant_normalized")) {
        return "Diese E-Mail-Adresse ist bereits bei einem anderen Kontakt hinterlegt.";
      }
      return `Verknüpfung fehlgeschlagen: ${error}`;
  }
}

export function inboxLinkContactImportWarning(
  messageImportError: string | undefined,
): string | null {
  if (!messageImportError?.trim()) return null;
  if (
    messageImportError === "meta_not_connected" ||
    messageImportError.includes("nicht verbunden")
  ) {
    return "Chat verknüpft — Nachrichten konnten nicht importiert werden (Meta nicht verbunden).";
  }
  return `Chat verknüpft — Nachrichtenimport: ${messageImportError}`;
}
