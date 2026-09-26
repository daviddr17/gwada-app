/**
 * Bestätigung an den Gast: die Kalenderdatei hängt nur an, wenn sie gebaut
 * wurde und WAHA sie annimmt. Sonst geht der Text allein raus.
 * Schon zugestellt (Datei oder Text) → nicht noch einmal schicken.
 */
export function shouldSendReservationConfirmationText(input: {
  calendarAttached: boolean;
  alreadyDelivered: boolean;
}): boolean {
  return !input.calendarAttached && !input.alreadyDelivered;
}
