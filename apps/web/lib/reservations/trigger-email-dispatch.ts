import type { DispatchEvent } from "@/lib/reservations/reservation-email-dispatch";
import type { EmailDispatchApiResult } from "@/lib/reservations/email-dispatch-client-response";

export type { EmailDispatchApiResult };

const GENERIC_SEND_FAILED = "E-Mail-Versand fehlgeschlagen.";

const SKIP_USER_MESSAGE: Record<string, string> = {
  notify_email_off: "E-Mail-Benachrichtigung ist für diese Reservierung aus.",
  email_disabled: "E-Mail-Integration ist plattformweit deaktiviert.",
  disabled: "Diese E-Mail-Benachrichtigung ist in den Reservierungseinstellungen deaktiviert.",
  no_settings: "Reservierungs-Einstellungen fehlen für dieses Restaurant.",
};

/** Nur für Superadmin: technische Hinweise bei bekannten Konfig-Codes */
const SUPERADMIN_ERROR_MESSAGE: Record<string, string> = {
  no_email: "Keine gültige E-Mail-Adresse für den Gast.",
  smtp_not_configured:
    "SMTP nicht konfiguriert (Fallback Superadmin oder eigene Verbindung unter Integrationen).",
  email_send_not_configured: "SUPABASE_SERVICE_ROLE_KEY fehlt auf dem Server.",
  server_misconfigured: "SUPABASE_SERVICE_ROLE_KEY fehlt auf dem Server.",
  send_failed: GENERIC_SEND_FAILED,
};

export function emailDispatchUserMessage(
  result: EmailDispatchApiResult | null,
  options?: { isSuperadmin?: boolean },
): string | null {
  const isSuperadmin = options?.isSuperadmin === true;

  if (!result) {
    return isSuperadmin
      ? "E-Mail-Versand konnte nicht gestartet werden (Netzwerkfehler)."
      : GENERIC_SEND_FAILED;
  }

  if (result.error) {
    if (isSuperadmin) {
      if (result.errorDetail) {
        return `E-Mail-Versand fehlgeschlagen: ${result.errorDetail}`;
      }
      return (
        SUPERADMIN_ERROR_MESSAGE[result.error] ??
        `E-Mail-Versand fehlgeschlagen: ${result.error}`
      );
    }
    return GENERIC_SEND_FAILED;
  }

  if (result.skipped) {
    if (isSuperadmin) {
      return SKIP_USER_MESSAGE[result.skipped] ?? null;
    }
    return null;
  }

  return null;
}

export async function triggerReservationEmailDispatch(
  reservationId: string,
  event: DispatchEvent,
): Promise<EmailDispatchApiResult | null> {
  try {
    const res = await fetch("/api/reservations/email/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId, event }),
    });
    const body = (await res.json().catch(() => ({}))) as EmailDispatchApiResult & {
      error?: string;
    };
    if (!res.ok) {
      const code = typeof body.error === "string" ? body.error : `http_${res.status}`;
      console.warn("[gwada] email dispatch", code, body.errorDetail ?? body);
      return body.errorDetail
        ? body
        : { ok: false, error: code };
    }
    return body;
  } catch (e) {
    console.warn("[gwada] email dispatch", e);
    return null;
  }
}
