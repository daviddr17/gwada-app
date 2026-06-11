const MAX_BYTES = 100 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export function validateNewsMediaFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return "Dateityp nicht erlaubt (Bild oder Video).";
  }
  if (file.size > MAX_BYTES) {
    return "Datei ist zu groß (max. 100 MB).";
  }
  return null;
}

export function newsMediaKindFromMime(mime: string): "image" | "video" {
  return mime.startsWith("video/") ? "video" : "image";
}
