import "server-only";

import { parseWahaMessageMedia } from "@/lib/contact-messages/waha-message-media";
import type { WahaServerConfig } from "@/lib/waha/waha-config";
import {
  wahaGetChatMessageById,
  wahaGetChatMessages,
  type WahaChatMessage,
} from "@/lib/waha/waha-inbox";

/** WAHA setzt in media.url oft localhost/interne Hosts — immer über config.baseUrl holen. */
export function resolveWahaMediaFetchUrl(
  config: WahaServerConfig,
  mediaUrl: string,
): string {
  const trimmed = mediaUrl.trim();
  if (!trimmed) return "";

  const base = config.baseUrl.replace(/\/$/, "");

  if (trimmed.startsWith("/")) {
    return `${base}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname || "";
    if (
      path.startsWith("/api/files") ||
      path.includes("/api/files/") ||
      path.startsWith("/files/")
    ) {
      return `${base}${path}${parsed.search}`;
    }
    // Relative host-Gleichheit egal: gleiche API-Pfadstruktur unter base
    if (path.startsWith("/api/")) {
      return `${base}${path}${parsed.search}`;
    }
    return trimmed;
  } catch {
    return `${base}/${trimmed.replace(/^\//, "")}`;
  }
}

function isRejectedMediaMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m.startsWith("text/html") ||
    m.startsWith("application/json") ||
    m.startsWith("text/plain")
  );
}

function extensionForMime(mime: string): string {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m === "application/pdf") return ".pdf";
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m.startsWith("audio/ogg") || m === "audio/opus") return ".ogg";
  if (m === "audio/mpeg" || m === "audio/mp3") return ".mp3";
  if (m.startsWith("video/mp4")) return ".mp4";
  if (m === "application/zip") return ".zip";
  if (
    m ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return ".docx";
  }
  if (m === "application/msword") return ".doc";
  return "";
}

type MediaSniff = { kind: "mime"; mime: string } | { kind: "reject" } | null;

function sniffMediaBytes(bytes: Uint8Array): MediaSniff {
  if (bytes.length >= 5) {
    const head = String.fromCharCode(...bytes.slice(0, 5));
    if (head === "%PDF-") return { kind: "mime", mime: "application/pdf" };
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { kind: "mime", mime: "image/jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { kind: "mime", mime: "image/png" };
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return { kind: "mime", mime: "application/zip" };
  }
  const start = String.fromCharCode(
    ...bytes.slice(0, Math.min(64, bytes.length)),
  )
    .trimStart()
    .toLowerCase();
  if (
    start.startsWith("<!doctype html") ||
    start.startsWith("<html") ||
    start.startsWith("<head") ||
    start.startsWith("{\"") ||
    start.startsWith("{ \"")
  ) {
    return { kind: "reject" };
  }
  return null;
}

export function ensureMediaFileName(
  fileName: string,
  mime: string,
): string {
  const raw = fileName.trim() || "Datei";
  const ext = extensionForMime(mime);
  if (!ext) return raw;
  if (/\.[a-z0-9]{2,8}$/i.test(raw) && raw.toLowerCase() !== "datei") {
    return raw;
  }
  if (raw.toLowerCase() === "datei" || raw === "Datei") {
    return `Datei${ext}`;
  }
  return `${raw}${ext}`;
}

async function wahaFetchBinary(
  config: WahaServerConfig,
  mediaUrl: string,
  fallbackMime?: string,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const path = resolveWahaMediaFetchUrl(config, mediaUrl);
  if (!path) return null;

  try {
    const res = await fetch(path, {
      headers: {
        "X-Api-Key": config.apiKey,
        Accept: "*/*",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const headerMime =
      res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (buffer.byteLength === 0) return null;

    const sniffed = sniffMediaBytes(buffer);
    if (sniffed?.kind === "reject") return null;
    if (isRejectedMediaMime(headerMime) && sniffed?.kind !== "mime") {
      return null;
    }

    const mime =
      (sniffed?.kind === "mime" ? sniffed.mime : null) ||
      (headerMime && !isRejectedMediaMime(headerMime) ? headerMime : null) ||
      (fallbackMime && !isRejectedMediaMime(fallbackMime)
        ? fallbackMime
        : null) ||
      "application/octet-stream";

    return { bytes: buffer, mime };
  } catch {
    return null;
  }
}

async function resolveMediaFromMessage(
  config: WahaServerConfig,
  msg: WahaChatMessage,
): Promise<{ bytes: Uint8Array; mime: string; fileName: string } | null> {
  const parsed = parseWahaMessageMedia(msg);
  if (!parsed?.url) return null;

  const fetched = await wahaFetchBinary(
    config,
    parsed.url,
    parsed.mimetype,
  );
  if (!fetched) return null;

  return {
    bytes: fetched.bytes,
    mime: fetched.mime || parsed.mimetype,
    fileName: ensureMediaFileName(
      parsed.filename || "Datei",
      fetched.mime || parsed.mimetype,
    ),
  };
}

export async function wahaResolveMessageMediaBlob(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  messageId: string;
}): Promise<{ blob: Blob; mime: string; fileName: string } | null> {
  const byId = await wahaGetChatMessageById({
    config: params.config,
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    messageId: params.messageId,
    downloadMedia: true,
  });
  if (byId.ok) {
    const fromId = await resolveMediaFromMessage(params.config, byId.data);
    if (fromId) {
      return {
        blob: new Blob([Buffer.from(fromId.bytes)], { type: fromId.mime }),
        mime: fromId.mime,
        fileName: fromId.fileName,
      };
    }
  }

  // Fallback: Chat-Verlauf scannen (ältere WAHA-Versionen ohne get-by-id).
  const result = await wahaGetChatMessages({
    config: params.config,
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    limit: 120,
    downloadMedia: true,
  });
  if (!result.ok) return null;

  const msg = result.data.find((m: WahaChatMessage) => m.id === params.messageId);
  if (!msg) return null;

  const resolved = await resolveMediaFromMessage(params.config, msg);
  if (!resolved) return null;

  return {
    blob: new Blob([Buffer.from(resolved.bytes)], { type: resolved.mime }),
    mime: resolved.mime,
    fileName: resolved.fileName,
  };
}
