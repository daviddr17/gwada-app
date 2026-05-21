import { toast } from "sonner";
import { GWADA_DB_UNAVAILABLE_MESSAGE } from "@/lib/constants/database-mode";

export function toastDatabaseUnavailable(): void {
  toast.error(GWADA_DB_UNAVAILABLE_MESSAGE, { duration: 10_000 });
}

/** Konkrete Supabase-/Postgres-Meldung (z. B. FK, Berechtigung) — nur wenn sinnvoll lesbar. */
export function toastDatabaseSaveError(message: string | undefined): void {
  const trimmed = message?.trim();
  if (!trimmed) {
    toastDatabaseUnavailable();
    return;
  }
  const friendly =
    trimmed.includes("inventory_po_fk_supplier") ||
    trimmed.includes("inventory_suppliers")
      ? "Lieferant fehlt in den Stammdaten. Bitte unter Bestand → Lieferanten speichern oder Seite neu laden."
      : trimmed.includes("permission denied for function") ||
          trimmed.includes("not authorized") ||
          trimmed.includes("42501")
        ? "Anmeldung fehlt oder ist abgelaufen — bitte erneut einloggen. Bei HTTPS-App: Supabase-Proxy in Coolify aktivieren (siehe docs/supabase-lokal-und-live.md)."
        : trimmed;
  toast.error(`Speichern fehlgeschlagen: ${friendly}`, { duration: 12_000 });
}
