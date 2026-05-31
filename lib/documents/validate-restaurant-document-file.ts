import {
  RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS,
  RESTAURANT_DOCUMENT_EXTENSION_MIMES,
  RESTAURANT_DOCUMENT_MAX_FILE_BYTES,
  type RestaurantDocumentExtension,
} from "@/lib/constants/restaurant-documents";

const ZIP_MIMES = new Set([
  "application/zip",
  "application/x-zip-compressed",
]);

export function restaurantDocumentExtension(
  fileName: string,
): RestaurantDocumentExtension | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return (RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(
    ext,
  )
    ? (ext as RestaurantDocumentExtension)
    : null;
}

/**
 * Kanonischer MIME für DB/Storage nach Endung + Browser-MIME.
 * `null` = nicht erlaubt (z. B. .pdf mit image/jpeg).
 */
export function resolveRestaurantDocumentMime(file: File): string | null {
  const ext = restaurantDocumentExtension(file.name);
  if (!ext) return null;

  const allowed = RESTAURANT_DOCUMENT_EXTENSION_MIMES[ext];
  const reported = file.type?.trim().toLowerCase() ?? "";

  if (!reported) {
    return allowed.find((m) => !ZIP_MIMES.has(m)) ?? allowed[0] ?? null;
  }

  if (allowed.includes(reported)) {
    if (ZIP_MIMES.has(reported) && ext !== "pages") return null;
    return reported;
  }

  return null;
}

/** Für `<input type="file" accept="…">`. */
export const RESTAURANT_DOCUMENT_FILE_ACCEPT = [
  ...RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`),
  ...new Set(
    Object.values(RESTAURANT_DOCUMENT_EXTENSION_MIMES).flat(),
  ),
].join(",");

/** `null` = ok, sonst Fehlermeldung (deutsch). */
export function validateRestaurantDocumentFile(file: File): string | null {
  if (file.size <= 0) return "Leere Datei.";
  if (file.size > RESTAURANT_DOCUMENT_MAX_FILE_BYTES) {
    return "Datei ist zu groß (max. 100 MB).";
  }
  if (!restaurantDocumentExtension(file.name)) {
    return "Nur PDF, Word, Pages oder CSV sind erlaubt.";
  }
  if (!resolveRestaurantDocumentMime(file)) {
    return "Dateityp passt nicht zur Endung oder ist nicht erlaubt.";
  }
  return null;
}
