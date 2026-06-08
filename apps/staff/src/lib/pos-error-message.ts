import { PosApiError } from "@/src/lib/pos-api";

/** Einheitliche Fehlermeldungen für POS-API-Aufrufe in der Staff-App. */
export function posApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof PosApiError) {
    if (err.status === 401) {
      return "Sitzung abgelaufen — bitte erneut anmelden.";
    }
    if (err.status === 502 && err.code === "export_not_available") {
      return "DSFinV-K Export bei Fiskaly noch nicht verfügbar. Kurz warten und erneut versuchen.";
    }
    return err.message;
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
