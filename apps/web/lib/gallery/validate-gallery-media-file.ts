const MAX_BYTES = 100 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export function validateGalleryMediaFile(file: File): string | null {
  if (file.size <= 0) return "empty_file";
  if (file.size > MAX_BYTES) return "file_too_large";
  if (!ALLOWED_MIME.has(file.type)) return "unsupported_type";
  return null;
}

export function galleryMediaKindFromMime(mime: string): "image" | "video" {
  return mime.startsWith("video/") ? "video" : "image";
}
