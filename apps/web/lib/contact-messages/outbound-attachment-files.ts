import {
  CONTACT_MESSAGE_ATTACHMENT_MAX_BYTES,
  CONTACT_MESSAGE_ATTACHMENT_MAX_FILES,
} from "@/lib/constants/contact-message-attachments";

export type OutboundAttachmentFile = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

const ALLOWED_PREFIXES = [
  "image/",
  "video/",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.",
  "application/zip",
  "application/octet-stream",
];

const VOICE_MIME_PREFIXES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"];

export function outboundAttachmentSendKind(
  mime: string,
): "image" | "video" | "voice" | "file" {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (VOICE_MIME_PREFIXES.some((p) => m.startsWith(p))) return "voice";
  return "file";
}

function mimeAllowed(mime: string): boolean {
  const m = mime.toLowerCase();
  if (VOICE_MIME_PREFIXES.some((p) => m.startsWith(p))) return false;
  return ALLOWED_PREFIXES.some((p) => m.startsWith(p));
}

export async function parseOutboundVoiceFile(
  file: File,
): Promise<{ ok: true; file: OutboundAttachmentFile } | { ok: false; error: string }> {
  if (file.size > CONTACT_MESSAGE_ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: "file_too_large" };
  }
  const mimeType = (file.type || "audio/webm").toLowerCase();
  if (!VOICE_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
    return { ok: false, error: "mime_not_allowed" };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    ok: true,
    file: {
      fileName: file.name.trim() || "sprachnachricht.webm",
      mimeType,
      bytes,
    },
  };
}

export function parseOutboundAttachmentFiles(
  files: File[],
): Promise<{ ok: true; files: OutboundAttachmentFile[] } | { ok: false; error: string }> {
  return (async () => {
    if (files.length > CONTACT_MESSAGE_ATTACHMENT_MAX_FILES) {
      return { ok: false, error: "too_many_files" };
    }
    const out: OutboundAttachmentFile[] = [];
    for (const file of files) {
      if (file.size > CONTACT_MESSAGE_ATTACHMENT_MAX_BYTES) {
        return { ok: false, error: "file_too_large" };
      }
      const mimeType = file.type || "application/octet-stream";
      if (!mimeAllowed(mimeType)) {
        return { ok: false, error: "mime_not_allowed" };
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      out.push({
        fileName: file.name.trim() || "anhang",
        mimeType,
        bytes,
      });
    }
    return { ok: true, files: out };
  })();
}

export function attachmentKindFromMime(
  mimeType: string,
): "image" | "file" {
  return mimeType.toLowerCase().startsWith("image/") ? "image" : "file";
}
