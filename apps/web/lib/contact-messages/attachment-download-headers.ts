/** Gemeinsame Download-Header für WhatsApp-/E-Mail-/Storage-Anhänge. */

export function attachmentContentDisposition(
  fileName: string,
  inline: boolean,
): string {
  const safe = (fileName.trim() || "Datei").replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(fileName.trim() || "Datei");
  const kind = inline ? "inline" : "attachment";
  return `${kind}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export function attachmentDownloadHeaders(params: {
  fileName: string;
  mimeType: string;
  inline?: boolean;
}): HeadersInit {
  const mime = params.mimeType || "application/octet-stream";
  const inline =
    params.inline ??
    (mime.startsWith("image/") ||
      mime.startsWith("audio/") ||
      mime.startsWith("video/"));
  const fileName = params.fileName.trim() || "Datei";

  return {
    "Content-Type": mime,
    "Content-Disposition": attachmentContentDisposition(fileName, inline),
    "X-Gwada-Filename": encodeURIComponent(fileName),
    "Cache-Control": "private, no-store",
  };
}
