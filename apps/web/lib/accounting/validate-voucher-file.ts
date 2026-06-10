const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const ACCOUNTING_VOUCHER_FILE_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

export const ACCOUNTING_VOUCHER_ALLOWED_LABEL = "PDF, JPEG, PNG, WebP, HEIC";

const MAX_BYTES = 52_428_800;

export function validateAccountingVoucherFile(
  file: File,
): string | null {
  if (file.size <= 0) return "Datei ist leer.";
  if (file.size > MAX_BYTES) return "Datei ist zu groß (max. 50 MB).";
  const mime = file.type || guessMimeFromName(file.name);
  if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
    return "Nur PDF oder Bilder (JPEG, PNG, WebP, HEIC) erlaubt.";
  }
  return null;
}

export function resolveAccountingVoucherMime(file: File): string | null {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return file.type;
  return guessMimeFromName(file.name);
}

function guessMimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return null;
}
