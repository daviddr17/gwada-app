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
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.",
  "application/zip",
  "application/octet-stream",
];

function mimeAllowed(mime: string): boolean {
  const m = mime.toLowerCase();
  return ALLOWED_PREFIXES.some((p) => m.startsWith(p));
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
