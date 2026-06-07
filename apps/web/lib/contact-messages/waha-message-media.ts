import type { WahaChatMessage } from "@/lib/waha/waha-inbox";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

export type WahaParsedMedia = {
  mimetype: string;
  filename: string;
  /** Relativ (/api/files/…) oder absolut. */
  url: string;
  kind: ContactMessageAttachmentKind;
};

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function kindFromMime(mime: string): ContactMessageAttachmentKind {
  return IMAGE_MIMES.has(mime.toLowerCase()) ? "image" : "file";
}

function mediaFromRecord(
  media: Record<string, unknown> | null | undefined,
  fallbackName: string,
): WahaParsedMedia | null {
  if (!media) return null;
  const url = typeof media.url === "string" ? media.url.trim() : "";
  if (!url) return null;
  const mimetype =
    (typeof media.mimetype === "string" ? media.mimetype : null) ??
    (typeof media.mimeType === "string" ? media.mimeType : null) ??
    "application/octet-stream";
  const filename =
    (typeof media.filename === "string" ? media.filename : null) ??
    (typeof media.fileName === "string" ? media.fileName : null) ??
    fallbackName;
  return {
    url,
    mimetype,
    filename,
    kind: kindFromMime(mimetype),
  };
}

export function parseWahaMessageMedia(m: WahaChatMessage): WahaParsedMedia | null {
  const raw = m as WahaChatMessage & {
    hasMedia?: boolean;
    media?: Record<string, unknown> | null;
    type?: string;
  };

  const top = mediaFromRecord(
    raw.media ?? undefined,
    raw.type === "image" ? "bild.jpg" : "datei",
  );
  if (top) return top;

  const data = raw._data;
  if (!data || typeof data !== "object") return null;

  const nested = mediaFromRecord(
    (data.media as Record<string, unknown> | undefined) ??
      (data._data as Record<string, unknown> | undefined)?.media as
        | Record<string, unknown>
        | undefined,
    "datei",
  );
  if (nested) return nested;

  const type = typeof data.type === "string" ? data.type : "";
  if (!raw.hasMedia && !data.hasMedia && !["image", "document", "video", "sticker"].includes(type)) {
    return null;
  }

  const mime =
    (typeof data.mimetype === "string" ? data.mimetype : null) ??
    (type === "image" ? "image/jpeg" : "application/octet-stream");
  const filename =
    (typeof data.filename === "string" ? data.filename : null) ??
    (type === "image" ? "bild.jpg" : "datei");

  return {
    url: "",
    mimetype: mime,
    filename,
    kind: kindFromMime(mime),
  };
}

export function wahaMessageHasDisplayableMedia(m: WahaChatMessage): boolean {
  return parseWahaMessageMedia(m) != null;
}

export function wahaMediaPreviewLabel(m: WahaChatMessage): string {
  const media = parseWahaMessageMedia(m);
  if (!media) return "";
  return media.kind === "image" ? "Bild" : media.filename;
}
