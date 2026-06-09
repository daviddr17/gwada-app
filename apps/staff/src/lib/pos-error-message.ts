import { PosApiError } from "@/src/lib/pos-api";

const POS_ERROR_MESSAGES: Record<string, string> = {
  register_closed:
    "Die Kasse ist geschlossen. Bitte zuerst in der Kasse öffnen, bevor du eine Bestellung aufnehmen kannst.",
  register_open_failed:
    "Die Kasse konnte nicht geöffnet werden. Bitte erneut versuchen.",
  register_already_open: "Die Kasse ist bereits geöffnet.",
  invalid_cover_count: "Ungültige Personenanzahl (1–50).",
  session_has_open_lines:
    "Es sind noch offene Positionen — bitte zuerst alles kassieren.",
  session_already_closed: "Diese Tisch-Session ist bereits geschlossen.",
  empty_allocations: "Bitte mindestens eine Position auswählen.",
  allocation_exceeds_open_quantity: "Menge übersteigt den offenen Rest.",
  order_already_paid: "Diese Bestellung ist bereits vollständig bezahlt.",
};

/** Einheitliche Fehlermeldungen für POS-API-Aufrufe in der Staff-App. */
export function posApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof PosApiError) {
    if (err.status === 401) {
      return "Sitzung abgelaufen — bitte erneut anmelden.";
    }
    if (err.status === 502 && err.code === "export_not_available") {
      return "DSFinV-K Export bei Fiskaly noch nicht verfügbar. Kurz warten und erneut versuchen.";
    }
    return POS_ERROR_MESSAGES[err.code] ?? err.message;
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return "Zeitüberschreitung — Web-API erreichbar? (`pnpm dev` im Projektroot)";
    }
    if (/network request failed|failed to fetch/i.test(err.message)) {
      return "Keine Verbindung zur Web-API. `pnpm dev` starten und URL in apps/staff/.env prüfen.";
    }
    return err.message;
  }
  return fallback;
}
