/** Workspace-Speicher gesamt (3 GB) — siehe restaurant_workspace_quota_bytes(). */
export const RESTAURANT_DOCUMENTS_QUOTA_BYTES = 3 * 1024 * 1024 * 1024;

/** Max single upload (100 MB); bucket limit matches migration. */
export const RESTAURANT_DOCUMENT_MAX_FILE_BYTES = 100 * 1024 * 1024;

export const RESTAURANT_DOCUMENTS_STORAGE_BUCKET = "restaurant-documents";

/** Nur echte Dokumentformate (Sicherheit). */
export const RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS = [
  "pdf",
  "pages",
  "doc",
  "docx",
  "csv",
  "png",
  "jpg",
  "jpeg",
] as const;

export type RestaurantDocumentExtension =
  (typeof RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS)[number];

/** Erwartete MIME-Typen pro Endung (Upload muss passen, wenn der Browser einen liefert). */
export const RESTAURANT_DOCUMENT_EXTENSION_MIMES: Record<
  RestaurantDocumentExtension,
  readonly string[]
> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  csv: ["text/csv", "application/csv", "text/comma-separated-values"],
  pages: [
    "application/vnd.apple.pages",
    "application/x-iwork-pages-sffpages",
    "application/vnd.apple.iwork",
    /** Apple Pages-Paket; nur mit Endung `.pages` erlaubt */
    "application/zip",
    "application/x-zip-compressed",
  ],
  png: ["image/png"],
  jpg: ["image/jpeg", "image/jpg"],
  jpeg: ["image/jpeg", "image/jpg"],
};

/** Storage-Bucket + schnelle Prüfung. */
export const RESTAURANT_DOCUMENT_ALLOWED_MIMES = new Set(
  Object.values(RESTAURANT_DOCUMENT_EXTENSION_MIMES).flat(),
);

export const RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS_LABEL =
  "PDF, Word (.doc/.docx), Pages, CSV, JPEG, PNG";
