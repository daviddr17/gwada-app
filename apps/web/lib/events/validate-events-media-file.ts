const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function validateEventsMediaFile(file: File): string | null {
  if (!ALLOWED.has(file.type)) {
    return "Nur JPEG, PNG oder WebP erlaubt.";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "Datei zu groß (max. 10 MB).";
  }
  return null;
}
