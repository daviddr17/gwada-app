import "server-only";

import { inboxPreviewSnippet } from "@/lib/contact-messages/inbox-preview-snippet";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

const MEDIA_META: Record<
  ContactMessageAttachmentKind,
  { emoji: string; label: string }
> = {
  image: { emoji: "📷", label: "Bild" },
  video: { emoji: "🎬", label: "Video" },
  voice: { emoji: "🎤", label: "Sprachnachricht" },
  file: { emoji: "📎", label: "Datei" },
};

const GENERIC_MEDIA_BODIES = new Set([
  "",
  "anhang",
  "whatsapp-anhang",
  "bild",
  "video",
  "sprachnachricht",
  "datei",
]);

export function isGenericMessageMediaBody(body: string): boolean {
  return GENERIC_MEDIA_BODIES.has(body.replace(/\s+/g, " ").trim().toLowerCase());
}

export function whatsappMediaMirrorBody(
  kind: ContactMessageAttachmentKind | null | undefined,
): string {
  if (kind === "image") return "Bild";
  if (kind === "voice") return "Sprachnachricht";
  if (kind === "video") return "Video";
  if (kind) return "Datei";
  return "WhatsApp-Anhang";
}

function mediaKindFromGenericBody(body: string): ContactMessageAttachmentKind | null {
  const lower = body.replace(/\s+/g, " ").trim().toLowerCase();
  if (lower === "bild") return "image";
  if (lower === "video") return "video";
  if (lower === "sprachnachricht") return "voice";
  if (
    lower === "datei" ||
    lower === "whatsapp-anhang" ||
    lower === "anhang"
  ) {
    return "file";
  }
  return null;
}

function senderLabelForPreview(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (trimmed === "Kontakt" || trimmed === "WhatsApp" || trimmed === "E-Mail") {
    return null;
  }
  return trimmed;
}

function mediaPushLine(
  kind: ContactMessageAttachmentKind,
  senderName?: string | null,
): string {
  const { emoji, label } = MEDIA_META[kind];
  const from = senderLabelForPreview(senderName);
  return from ? `${emoji} ${label} von ${from}` : `${emoji} ${label}`;
}

/** Push-Vorschau: Text oder „📷 Bild von Max“ bei reinen Medien-Nachrichten. */
export function buildMessagePushPreview(params: {
  body: string;
  attachmentKind?: ContactMessageAttachmentKind | null;
  senderName?: string | null;
  max?: number;
}): string {
  const max = params.max ?? 120;
  const body = params.body.replace(/\s+/g, " ").trim();

  if (body && !isGenericMessageMediaBody(body)) {
    const snippet = inboxPreviewSnippet(body, undefined, max);
    return snippet.length <= max ? snippet : `${snippet.slice(0, max - 1)}…`;
  }

  const kind =
    params.attachmentKind ?? (body ? mediaKindFromGenericBody(body) : null);
  if (kind) {
    return mediaPushLine(kind, params.senderName).slice(0, max);
  }

  if (body) {
    return body.slice(0, max);
  }

  const from = senderLabelForPreview(params.senderName);
  return from
    ? `Neue Nachricht von ${from}`.slice(0, max)
    : "Neue Nachricht";
}
