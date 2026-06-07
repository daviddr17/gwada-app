export type EmailDispatchApiResult = {
  ok: boolean;
  skipped?: string;
  /** Für Clients: kurzer Code oder generisch `send_failed` */
  error?: string;
  /** Nur Superadmin: technische Details (SMTP-Antwort o. Ä.) */
  errorDetail?: string;
};

const PUBLIC_ERROR = "send_failed";

const KNOWN_ERROR_CODES = new Set([
  "no_email",
  "smtp_not_configured",
  "send_failed",
  "server_misconfigured",
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_request",
  "reservation_not_found",
]);

function isTechnicalSmtpError(error: string): boolean {
  if (KNOWN_ERROR_CODES.has(error)) return false;
  return true;
}

/** Antwort für Browser: keine SMTP-Details für normale Nutzer. */
export function emailDispatchResultForClient(
  result: { ok: boolean; skipped?: string; error?: string },
  isSuperadmin: boolean,
): EmailDispatchApiResult {
  if (!result.error) {
    return { ok: result.ok, skipped: result.skipped };
  }

  if (isSuperadmin) {
    const code = isTechnicalSmtpError(result.error)
      ? PUBLIC_ERROR
      : result.error;
    return {
      ok: result.ok,
      skipped: result.skipped,
      error: code,
      errorDetail: isTechnicalSmtpError(result.error) ? result.error : undefined,
    };
  }

  if (isTechnicalSmtpError(result.error)) {
    return { ok: false, error: PUBLIC_ERROR };
  }

  return { ok: result.ok, skipped: result.skipped, error: result.error };
}
