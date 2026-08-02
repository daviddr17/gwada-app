import { cn } from "@/lib/utils";

/** DB / UI status keys for WhatsApp sessions. */
export type WahaUiSessionStatus =
  | "working"
  | "scan_qr"
  | "starting"
  | "failed"
  | "stopped"
  | "disconnected"
  | string;

export function normalizeWahaUiStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

export function wahaSessionStatusLabel(status: string | null | undefined): string {
  switch (normalizeWahaUiStatus(status)) {
    case "working":
      return "Arbeitet";
    case "scan_qr":
      return "QR scannen";
    case "starting":
      return "Startet";
    case "failed":
      return "Fehler";
    case "stopped":
      return "Gestoppt";
    case "disconnected":
      return "Getrennt";
    default:
      return status?.trim() || "Unbekannt";
  }
}

/** Live WAHA API status (UPPERCASE). */
export function wahaLiveStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").trim().toUpperCase()) {
    case "WORKING":
      return "WORKING · arbeitet";
    case "SCAN_QR_CODE":
      return "SCAN_QR · QR scannen";
    case "STARTING":
      return "STARTING · startet";
    case "FAILED":
      return "FAILED · Fehler";
    case "STOPPED":
      return "STOPPED · gestoppt";
    default:
      return status?.trim() || "—";
  }
}

export function wahaSessionStatusBadgeClassName(
  status: string | null | undefined,
): string {
  const s = normalizeWahaUiStatus(status);
  if (s === "working") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (s === "scan_qr" || s === "starting") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  if (s === "failed") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (s === "stopped" || s === "disconnected") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200";
  }
  return "text-muted-foreground";
}

export function wahaLiveStatusBadgeClassName(
  status: string | null | undefined,
): string {
  const s = (status ?? "").trim().toUpperCase();
  if (s === "WORKING") {
    return wahaSessionStatusBadgeClassName("working");
  }
  if (s === "SCAN_QR_CODE" || s === "STARTING") {
    return wahaSessionStatusBadgeClassName("starting");
  }
  if (s === "FAILED") {
    return wahaSessionStatusBadgeClassName("failed");
  }
  if (s === "STOPPED") {
    return wahaSessionStatusBadgeClassName("stopped");
  }
  return cn("text-muted-foreground");
}
