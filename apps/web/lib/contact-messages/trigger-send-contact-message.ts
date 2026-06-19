export type SendContactMessageApiResult = {
  ok: boolean;
  errors?: string[];
  error?: string;
  /** WAHA-Nachrichten-ID — für Reactions direkt nach dem Senden. */
  wahaMessageId?: string | null;
  messageId?: string;
  clientSendId?: string;
};

function appendSendFormFields(
  fd: FormData,
  fields: Record<string, string | undefined>,
) {
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== "") fd.append(key, value);
  }
}

export async function triggerSendContactMessage(body: {
  restaurantId: string;
  contactId: string;
  messageBody: string;
  direction: "inbound" | "outbound";
  channels: (
    | "gwada"
    | "whatsapp"
    | "email"
    | "facebook"
    | "instagram"
  )[];
  reservationId?: string | null;
  restaurantName?: string | null;
  clientSendId?: string;
  files?: File[];
  voiceNote?: File;
}): Promise<SendContactMessageApiResult | null> {
  try {
    const hasFiles = (body.files?.length ?? 0) > 0;
    const hasVoice = Boolean(body.voiceNote);
    let fetchBody: BodyInit;
    let headers: HeadersInit | undefined;
    if (hasFiles || hasVoice) {
      const fd = new FormData();
      appendSendFormFields(fd, {
        restaurantId: body.restaurantId,
        contactId: body.contactId,
        messageBody: body.messageBody,
        direction: body.direction,
        channels: body.channels.join(","),
        reservationId: body.reservationId ?? undefined,
        restaurantName: body.restaurantName ?? undefined,
        clientSendId: body.clientSendId,
      });
      for (const file of body.files ?? []) fd.append("files", file);
      if (body.voiceNote) fd.append("voiceNote", body.voiceNote);
      fetchBody = fd;
    } else {
      headers = { "Content-Type": "application/json" };
      fetchBody = JSON.stringify(body);
    }
    const res = await fetch("/api/contact-messages/send", {
      method: "POST",
      headers,
      body: fetchBody,
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
  file_too_large: "Eine Datei ist zu groß (max. 15 MB).",
  too_many_files: "Zu viele Dateien (max. 5).",
  mime_not_allowed: "Dateityp nicht erlaubt.",
  contact_already_reviewed:
    "Dieser Kontakt hat bereits eine Gwada-Bewertung abgegeben. Es kann kein neuer Einladungslink verschickt werden.",
  "meta:meta_not_connected":
    "Facebook/Instagram ist nicht verbunden — unter Einstellungen → Integrationen prüfen.",
  meta_not_connected:
    "Facebook/Instagram ist nicht verbunden — unter Einstellungen → Integrationen prüfen.",
  "facebook:no_messaging_id":
    "Keine Messenger-ID für diesen Kontakt hinterlegt.",
  "instagram:no_messaging_id":
    "Keine Instagram-ID für diesen Kontakt hinterlegt.",
};

function formatChannelErrors(errors: string[] | undefined): string | null {
  if (!errors?.length) return null;
  for (const code of errors) {
    if (CHANNEL_ERROR_DE[code]) return CHANNEL_ERROR_DE[code];
  }
  for (const code of errors) {
    const bare = code.split(":").pop();
    if (bare && CHANNEL_ERROR_DE[bare]) return CHANNEL_ERROR_DE[bare];
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
  const meta = errors.find(
    (e) => e.startsWith("facebook:") || e.startsWith("instagram:"),
  );
  if (meta) {
    const detail = meta.replace(/^(facebook|instagram):/, "");
    return `Messenger/Instagram-Versand fehlgeschlagen: ${detail}`;
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
  files?: File[];
}): Promise<SendContactMessageApiResult | null> {
  try {
    const hasFiles = (body.files?.length ?? 0) > 0;
    let fetchBody: BodyInit;
    let headers: HeadersInit | undefined;
    if (hasFiles) {
      const fd = new FormData();
      appendSendFormFields(fd, {
        restaurantId: body.restaurantId,
        emailContactId: body.emailContactId,
        contactId: body.contactId,
        messageBody: body.messageBody,
        restaurantName: body.restaurantName ?? undefined,
        storeUnderContact:
          body.storeUnderContact === false ? "false" : undefined,
      });
      for (const file of body.files!) fd.append("files", file);
      fetchBody = fd;
    } else {
      headers = { "Content-Type": "application/json" };
      fetchBody = JSON.stringify(body);
    }
    const res = await fetch("/api/contact-messages/email/send", {
      method: "POST",
      headers,
      body: fetchBody,
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

export async function triggerMetaSendMessage(body: {
  restaurantId: string;
  metaContactId: string;
  messageBody: string;
  files?: File[];
  voiceNote?: File;
}): Promise<SendContactMessageApiResult | null> {
  try {
    const hasFiles = (body.files?.length ?? 0) > 0;
    const hasVoice = Boolean(body.voiceNote);
    let fetchBody: BodyInit;
    let headers: HeadersInit | undefined;
    if (hasFiles || hasVoice) {
      const fd = new FormData();
      appendSendFormFields(fd, {
        restaurantId: body.restaurantId,
        metaContactId: body.metaContactId,
        messageBody: body.messageBody,
      });
      for (const file of body.files ?? []) fd.append("files", file);
      if (body.voiceNote) fd.append("voiceNote", body.voiceNote);
      fetchBody = fd;
    } else {
      headers = { "Content-Type": "application/json" };
      fetchBody = JSON.stringify(body);
    }
    const res = await fetch("/api/contact-messages/meta/send", {
      method: "POST",
      headers,
      body: fetchBody,
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
  clientSendId?: string;
  storeUnderContact?: boolean;
  files?: File[];
  voiceNote?: File;
}): Promise<SendContactMessageApiResult | null> {
  try {
    const hasFiles = (body.files?.length ?? 0) > 0;
    const hasVoice = Boolean(body.voiceNote);
    let fetchBody: BodyInit;
    let headers: HeadersInit | undefined;
    if (hasFiles || hasVoice) {
      const fd = new FormData();
      appendSendFormFields(fd, {
        restaurantId: body.restaurantId,
        wahaContactId: body.wahaContactId,
        contactId: body.contactId,
        messageBody: body.messageBody,
        clientSendId: body.clientSendId,
        storeUnderContact:
          body.storeUnderContact === false ? "false" : undefined,
      });
      for (const file of body.files ?? []) fd.append("files", file);
      if (body.voiceNote) fd.append("voiceNote", body.voiceNote);
      fetchBody = fd;
    } else {
      headers = { "Content-Type": "application/json" };
      fetchBody = JSON.stringify(body);
    }
    const res = await fetch("/api/contact-messages/waha/send", {
      method: "POST",
      headers,
      body: fetchBody,
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

export async function triggerLinkMetaThreadToContact(body: {
  restaurantId: string;
  metaContactId: string;
  contactId: string;
}): Promise<{
  ok: boolean;
  imported?: number;
  error?: string;
  messageImportError?: string | null;
} | null> {
  try {
    const res = await fetch("/api/contact-messages/meta/link-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => null)) as {
      ok: boolean;
      imported?: number;
      error?: string;
      messageImportError?: string | null;
    };
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

export async function triggerLinkEmailThreadToContact(body: {
  restaurantId: string;
  emailPseudoContactId: string;
  contactId: string;
}): Promise<{ ok: boolean; imported?: number; error?: string } | null> {
  try {
    const res = await fetch("/api/contact-messages/email/link-contact", {
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
