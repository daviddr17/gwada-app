"use client";

import { toast } from "sonner";

/** Einheitliche Fehlermeldung bei localStorage / Serialisierungsfehlern */
export const STORAGE_ERROR_TOAST =
  "Speichern fehlgeschlagen. Speicher könnte voll sein oder der private Modus blockiert den Zugriff.";

export function toastStorageError(): void {
  toast.error(STORAGE_ERROR_TOAST);
}
