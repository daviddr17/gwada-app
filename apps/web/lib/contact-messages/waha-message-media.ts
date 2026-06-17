import type { WahaChatMessage } from "@/lib/waha/waha-inbox";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

export type WahaParsedMedia = {
  mimetype: string;
  filename: string;
  /** Relativ (/api/files/…) oder absolut. */
  url: string;
  kind: ContactMessageAttachmentKind;
  durationSeconds?: number | null;
};

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VOICE_WAHA_TYPES = new Set([
  "ptt",
  "voice",
  "audio",
  "media_audio",
]);

const MEDIA_WAHA_TYPES = new Set([
  "image",
  "document",
  "video",
  "sticker",
  ...VOICE_WAHA_TYPES,
]);

function readStringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function protobufMediaKind(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null;
  const message = data.message;
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;
  if (msg.audioMessage || msg.pttMessage) return "ptt";
  if (msg.videoMessage) return "video";
  if (msg.imageMessage || msg.stickerMessage) return "image";
  if (msg.documentMessage) return "document";
  return null;
}

function resolveWahaMessageType(
  raw: { type?: string; hasMedia?: boolean; media?: { mimetype?: string | null } | null },
  data: Record<string, unknown> | null | undefined,
): string {
  const topType = readStringField(raw.type).toLowerCase();
  if (topType) return topType;

  const dataType = readStringField(data?.type).toLowerCase();
  if (dataType) return dataType;

  const messageType = readStringField(data?.messageType).toLowerCase();
  if (messageType) return messageType;

  const proto = protobufMediaKind(data ?? undefined);
  if (proto) return proto;

  const mediaMime = readStringField(raw.media?.mimetype).toLowerCase();
  if (mediaMime.startsWith("audio/")) return "ptt";
  if (mediaMime.startsWith("video/")) return "video";
  if (mediaMime.startsWith("image/")) return "image";

  const dataMime = readStringField(data?.mimetype).toLowerCase();
  if (dataMime.startsWith("audio/")) return "ptt";
  if (dataMime.startsWith("video/")) return "video";
  if (dataMime.startsWith("image/")) return "image";

  return "";
}

function readDurationSeconds(
  data: Record<string, unknown> | null | undefined,
): number | null {
  if (!data) return null;

  const message = data.message;
  if (message && typeof message === "object") {
    const msg = message as Record<string, unknown>;
    const audio =
      (msg.audioMessage as Record<string, unknown> | undefined) ??
      (msg.pttMessage as Record<string, unknown> | undefined);
    const audioSeconds = audio?.seconds;
    if (typeof audioSeconds === "number" && Number.isFinite(audioSeconds) && audioSeconds > 0) {
      return Math.round(audioSeconds);
    }
  }

  const raw =
    data.duration ??
    data.seconds ??
    (data.audio as Record<string, unknown> | undefined)?.seconds;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  return null;
}

export function attachmentKindFromWahaTypeAndMime(
  wahaType: string,
  mime: string,
): ContactMessageAttachmentKind {
  const type = wahaType.toLowerCase();
  const m = mime.toLowerCase();
  if (VOICE_WAHA_TYPES.has(type) || m.startsWith("audio/")) return "voice";
  if (type === "video" || m.startsWith("video/")) return "video";
  if (type === "image" || type === "sticker" || IMAGE_MIMES.has(m)) return "image";
  return "file";
}

function kindFromMime(mime: string, wahaType = ""): ContactMessageAttachmentKind {
  return attachmentKindFromWahaTypeAndMime(wahaType, mime);
}

function mediaFromRecord(
  media: Record<string, unknown> | null | undefined,
  fallbackName: string,
  wahaType = "",
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
    kind: kindFromMime(mimetype, wahaType),
  };
}

function fallbackFilenameForType(dataType: string): string {
  if (dataType === "image" || dataType === "sticker") return "bild.jpg";
  if (dataType === "video") return "video.mp4";
  if (VOICE_WAHA_TYPES.has(dataType)) return "sprachnachricht.ogg";
  return "datei";
}

function fallbackMimeForType(dataType: string): string {
  if (dataType === "image" || dataType === "sticker") return "image/jpeg";
  if (dataType === "video") return "video/mp4";
  if (VOICE_WAHA_TYPES.has(dataType)) return "audio/ogg; codecs=opus";
  return "application/octet-stream";
}

export function parseWahaMessageMedia(m: WahaChatMessage): WahaParsedMedia | null {
  const raw = m as WahaChatMessage & {
    hasMedia?: boolean;
    media?: Record<string, unknown> | null;
    type?: string;
  };

  const data =
    raw._data && typeof raw._data === "object"
      ? (raw._data as Record<string, unknown>)
      : null;
  const dataType = resolveWahaMessageType(raw, data);

  const top = mediaFromRecord(
    raw.media ?? undefined,
    fallbackFilenameForType(dataType),
    dataType,
  );
  if (top) {
    return {
      ...top,
      durationSeconds: readDurationSeconds(data),
    };
  }

  if (!data) {
    if (!raw.hasMedia) return null;
    const mime = fallbackMimeForType(dataType);
    return {
      url: "",
      mimetype: mime,
      filename: fallbackFilenameForType(dataType),
      kind: kindFromMime(mime, dataType),
    };
  }

  const nested = mediaFromRecord(
    (data.media as Record<string, unknown> | undefined) ??
      (data._data as Record<string, unknown> | undefined)?.media as
        | Record<string, unknown>
        | undefined,
    fallbackFilenameForType(dataType),
    dataType,
  );
  if (nested) {
    return {
      ...nested,
      durationSeconds: readDurationSeconds(data),
    };
  }

  if (!raw.hasMedia && !data.hasMedia && !MEDIA_WAHA_TYPES.has(dataType)) {
    return null;
  }

  const mime =
    readStringField(data.mimetype) ||
    readStringField(raw.media?.mimetype) ||
    fallbackMimeForType(dataType);
  const filename =
    readStringField(data.filename) || fallbackFilenameForType(dataType);

  return {
    url: "",
    mimetype: mime,
    filename,
    kind: kindFromMime(mime, dataType),
    durationSeconds: readDurationSeconds(data),
  };
}

export function wahaMessageHasDisplayableMedia(m: WahaChatMessage): boolean {
  return parseWahaMessageMedia(m) != null;
}

export function wahaMediaPreviewLabel(m: WahaChatMessage): string {
  const media = parseWahaMessageMedia(m);
  if (!media) return "";
  if (media.kind === "image") return "Bild";
  if (media.kind === "voice") return "Sprachnachricht";
  if (media.kind === "video") return "Video";
  return media.filename;
}

/** Medientyp aus WAHA-Webhook-Payload (Push / Mirror-Body). */
export function wahaWebhookPayloadMediaKind(
  payload: {
    hasMedia?: boolean;
    body?: string;
    type?: string;
    media?: { mimetype?: string | null } | null;
    _data?: unknown;
  } | null
  | undefined,
): ContactMessageAttachmentKind | null {
  if (!payload?.hasMedia) return null;
  return parseWahaMessageMedia(payload as WahaChatMessage)?.kind ?? "file";
}
