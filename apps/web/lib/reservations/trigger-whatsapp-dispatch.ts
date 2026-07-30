import type { DispatchEvent } from "@/lib/reservations/reservation-whatsapp-dispatch";

export type WhatsappDispatchApiResult = {
  ok: boolean;
  skipped?: string;
  error?: string;
  messageBody?: string;
  messageId?: string;
  wahaMessageId?: string | null;
  threadContactId?: string;
};

const SKIP_USER_MESSAGE: Record<string, string> = {
  notify_whatsapp_off: "WhatsApp-Benachrichtigung ist für diese Reservierung aus.",
  whatsapp_not_connected:
    "WhatsApp ist nicht verbunden — bitte unter Einstellungen → Integrationen verknüpfen.",
  waha_session_not_working:
    "WhatsApp-Session ist nicht aktiv — Integrationen prüfen oder neu verbinden.",
  no_settings: "Reservierungs-Einstellungen fehlen für dieses Restaurant.",
};

const API_ERROR_MESSAGE: Record<string, string> = {
  no_phone: "Keine gültige Telefonnummer für WhatsApp.",
  waha_not_configured:
    "WhatsApp-Server nicht konfiguriert — Superadmin → Integrationen (WAHA API-Link & Key).",
  server_misconfigured:
    "Server: SUPABASE_SERVICE_ROLE_KEY fehlt — Dev-Server neu starten.",
  unauthorized: "Nicht angemeldet — WhatsApp-Versand abgebrochen.",
  forbidden: "Keine Berechtigung für diese Reservierung.",
  not_found: "Reservierung nicht gefunden.",
  invalid_request: "WhatsApp-Versand: ungültige Anfrage.",
};

export function whatsappDispatchUserMessage(
  result: WhatsappDispatchApiResult | null,
): string | null {
  if (!result) {
    return "WhatsApp-Versand konnte nicht gestartet werden (Netzwerkfehler).";
  }
  if (result.error) {
    return (
      API_ERROR_MESSAGE[result.error] ??
      `WhatsApp-Versand fehlgeschlagen: ${result.error}`
    );
  }
  if (result.skipped) {
    return SKIP_USER_MESSAGE[result.skipped] ?? null;
  }
  return null;
}

export async function triggerReservationWhatsappDispatch(
  reservationId: string,
  event: DispatchEvent,
  options?: { guestNotifyMessage?: string | null },
): Promise<WhatsappDispatchApiResult | null> {
  try {
    const res = await fetch("/api/reservations/whatsapp/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationId,
        event,
        guestNotifyMessage: options?.guestNotifyMessage ?? undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as WhatsappDispatchApiResult & {
      error?: string;
    };
    if (!res.ok) {
      const code = typeof body.error === "string" ? body.error : `http_${res.status}`;
      console.warn("[gwada] whatsapp dispatch", code, body);
      return { ok: false, error: code };
    }
    return body;
  } catch (e) {
    console.warn("[gwada] whatsapp dispatch", e);
    return null;
  }
}
