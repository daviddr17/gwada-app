import {
  GWADA_DEFAULT_FROM_EMAIL,
  GWADA_DEFAULT_FROM_NAME,
} from "@/lib/constants/gwada-email-defaults";
import { getN8nEmailConfig } from "@/lib/n8n/n8n-config";

export type N8nEmailSender = {
  mode: "default" | "custom";
  email: string;
  name: string;
};

/** SMTP/IMAP-Zugangsdaten für den n8n Send-Email-Node (dynamisch pro Absender). */
export type N8nEmailSmtp = {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
};

export type N8nReservationEmailPayload = {
  restaurantId: string;
  reservationId: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  sender: N8nEmailSender;
  smtp: N8nEmailSmtp;
  meta: {
    messageKind: string;
    reservationNumber: number;
  };
};

export function resolveEmailSender(params: {
  useCustom: boolean;
  fromEmail?: string | null;
  fromName?: string | null;
  restaurantFallbackName?: string | null;
}): N8nEmailSender {
  const email = params.fromEmail?.trim();
  const name =
    params.fromName?.trim() ||
    params.restaurantFallbackName?.trim() ||
    GWADA_DEFAULT_FROM_NAME;

  if (params.useCustom && email) {
    return { mode: "custom", email, name };
  }

  return {
    mode: "default",
    email: GWADA_DEFAULT_FROM_EMAIL,
    name: GWADA_DEFAULT_FROM_NAME,
  };
}

export function reservationEmailTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="font-family:sans-serif;white-space:pre-wrap">${escaped}</pre>`;
}

export async function n8nSendReservationEmail(
  payload: N8nReservationEmailPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getN8nEmailConfig();
  if (!config) {
    return { ok: false, error: "n8n_not_configured" };
  }

  const body: N8nReservationEmailPayload = {
    ...payload,
    html: payload.html || reservationEmailTextToHtml(payload.text),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.webhookSecret) {
    headers.Authorization = `Bearer ${config.webhookSecret}`;
  }

  let res: Response;
  try {
    res = await fetch(config.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }

  if (!res.ok) {
    let error = `n8n_${res.status}`;
    try {
      const data = (await res.json()) as { message?: string; error?: string };
      error = data.message ?? data.error ?? error;
    } catch {
      /* ignore */
    }
    return { ok: false, error };
  }

  return { ok: true };
}
