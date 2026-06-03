export type SendContactMessageApiResult = {
  ok: boolean;
  errors?: string[];
  error?: string;
};

export async function triggerSendContactMessage(body: {
  restaurantId: string;
  contactId: string;
  messageBody: string;
  direction: "inbound" | "outbound";
  channels: ("gwada" | "whatsapp" | "email")[];
  reservationId?: string | null;
  restaurantName?: string | null;
}): Promise<SendContactMessageApiResult | null> {
  try {
    const res = await fetch("/api/contact-messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as SendContactMessageApiResult;
    if (!res.ok) {
      const code = typeof data.error === "string" ? data.error : `http_${res.status}`;
      return { ok: false, error: code, errors: data.errors };
    }
    return data;
  } catch {
    return null;
  }
}

const CHANNEL_ERROR_DE: Record<string, string> = {
  "whatsapp:session_not_working":
    "WhatsApp-Session ist nicht aktiv — unter Einstellungen → Integrationen prüfen.",
  "whatsapp:no_phone":
    "Keine gültige Telefonnummer für WhatsApp (Gast oder Kontakt).",
  "whatsapp:whatsapp_unavailable":
    "WhatsApp ist nicht verbunden oder die Nummer ist ungültig.",
  "whatsapp:number_not_registered":
    "Diese Telefonnummer ist bei WhatsApp nicht registriert.",
  "email:no_email": "Keine E-Mail-Adresse für den Gast hinterlegt.",
  "email:smtp_not_configured":
    "E-Mail-Versand ist nicht konfiguriert (SMTP / Server).",
  contact_already_reviewed:
    "Dieser Kontakt hat bereits eine Gwada-Bewertung abgegeben. Es kann kein neuer Einladungslink verschickt werden.",
};

function formatChannelErrors(errors: string[] | undefined): string | null {
  if (!errors?.length) return null;
  for (const code of errors) {
    if (CHANNEL_ERROR_DE[code]) return CHANNEL_ERROR_DE[code];
  }
  const wa = errors.find((e) => e.startsWith("whatsapp:"));
  if (wa) {
    const detail = wa.replace(/^whatsapp:/, "");
    return `WhatsApp-Versand fehlgeschlagen: ${detail}`;
  }
  const em = errors.find((e) => e.startsWith("email:"));
  if (em) {
    const detail = em.replace(/^email:/, "");
    return `E-Mail-Versand fehlgeschlagen: ${detail}`;
  }
  return "Einige Kanäle konnten nicht zugestellt werden.";
}

export async function triggerEmailInboxSend(body: {
  restaurantId: string;
  emailContactId?: string;
  contactId?: string;
  messageBody: string;
  restaurantName?: string | null;
  storeUnderContact?: boolean;
}): Promise<SendContactMessageApiResult | null> {
  try {
    const res = await fetch("/api/contact-messages/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as SendContactMessageApiResult;
    if (!res.ok) {
      const code = typeof data.error === "string" ? data.error : `http_${res.status}`;
      return { ok: false, error: code, errors: data.errors };
    }
    return data;
  } catch {
    return null;
  }
}

export async function triggerWahaSendMessage(body: {
  restaurantId: string;
  wahaContactId?: string;
  contactId?: string;
  messageBody: string;
  storeUnderContact?: boolean;
}): Promise<SendContactMessageApiResult | null> {
  try {
    const res = await fetch("/api/contact-messages/waha/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as SendContactMessageApiResult;
    if (!res.ok) {
      const code = typeof data.error === "string" ? data.error : `http_${res.status}`;
      return { ok: false, error: code, errors: data.errors };
    }
    return data;
  } catch {
    return null;
  }
}

export async function triggerLinkWahaThreadToContact(body: {
  restaurantId: string;
  wahaContactId: string;
  contactId: string;
}): Promise<{ ok: boolean; imported?: number; error?: string } | null> {
  try {
    const res = await fetch("/api/contact-messages/waha/link-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => null)) as {
      ok: boolean;
      imported?: number;
      error?: string;
    };
  } catch {
    return null;
  }
}

export function sendContactMessageUserMessage(
  result: SendContactMessageApiResult | null,
): string | null {
  if (!result) {
    return "Nachricht konnte nicht gesendet werden (Netzwerkfehler).";
  }
  if (result.error === "forbidden") {
    return "Keine Berechtigung.";
  }
  if (result.error === "not_found") {
    return "Kontakt nicht gefunden.";
  }
  const channelMsg = formatChannelErrors(result.errors);
  if (channelMsg) return channelMsg;
  if (!result.ok && result.error) {
    return `Senden fehlgeschlagen: ${result.error}`;
  }
  return null;
}
