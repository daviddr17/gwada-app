import "server-only";

import { after } from "next/server";
import type { EmailSmtpCredentials } from "@/lib/email/email-delivery";
import {
  sendViaSmtp,
  type SmtpSendPayload,
} from "@/lib/email/send-via-smtp";

export type PreparedAuthEmailJob =
  | { kind: "noop" }
  | {
      kind: "send";
      smtp: EmailSmtpCredentials;
      payload: SmtpSendPayload;
      logLabel: string;
    };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** SMTP mit Retries — läuft in `after()`, nicht im HTTP-Request. */
export async function sendViaSmtpWithRetry(
  smtp: EmailSmtpCredentials,
  payload: SmtpSendPayload,
  options?: { attempts?: number; logLabel?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attempts = options?.attempts ?? 3;
  const label = options?.logLabel ?? "auth-email";
  let lastError = "smtp_send_failed";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) {
      await sleep(2_000 * (attempt - 1));
    }
    const result = await sendViaSmtp(smtp, payload);
    if (result.ok) return result;
    lastError = result.error;
    console.warn(
      `[${label}] SMTP attempt ${attempt}/${attempts} failed:`,
      lastError,
    );
  }

  return { ok: false, error: lastError };
}

/** Antwort sofort an Client; langsamer SMTP-Versand danach. */
export function scheduleAuthEmailInBackground(
  prepared: PreparedAuthEmailJob,
): void {
  if (prepared.kind !== "send") return;

  after(async () => {
    const result = await sendViaSmtpWithRetry(
      prepared.smtp,
      prepared.payload,
      { logLabel: prepared.logLabel },
    );
    if (!result.ok) {
      console.error(
        `[${prepared.logLabel}] background send failed after retries:`,
        result.error,
      );
    }
  });
}
