import { RESTAURANT_DOCUMENT_MAX_FILE_BYTES } from "@/lib/constants/restaurant-documents";

export const STAFF_CONTRACT_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
] as const;

export type StaffContractAttachmentExtension =
  (typeof STAFF_CONTRACT_ATTACHMENT_EXTENSIONS)[number];

const STAFF_CONTRACT_ATTACHMENT_MIMES: Record<
  StaffContractAttachmentExtension,
  readonly string[]
> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg", "image/jpg"],
  jpeg: ["image/jpeg", "image/jpg"],
};

export const STAFF_CONTRACT_ATTACHMENT_ACCEPT = [
  ...STAFF_CONTRACT_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`),
  ...new Set(Object.values(STAFF_CONTRACT_ATTACHMENT_MIMES).flat()),
].join(",");

export const STAFF_CONTRACT_ATTACHMENT_LABEL = "PDF, JPEG oder PNG";

function staffContractAttachmentExtension(
  fileName: string,
): StaffContractAttachmentExtension | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return (STAFF_CONTRACT_ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext as StaffContractAttachmentExtension)
    : null;
}

export function resolveStaffContractAttachmentMime(file: File): string | null {
  const ext = staffContractAttachmentExtension(file.name);
  if (!ext) return null;

  const allowed = STAFF_CONTRACT_ATTACHMENT_MIMES[ext];
  const reported = file.type?.trim().toLowerCase() ?? "";

  if (!reported) {
    return allowed[0] ?? null;
  }

  if (allowed.includes(reported)) {
    return reported === "image/jpg" ? "image/jpeg" : reported;
  }

  return null;
}

/** `null` = ok, sonst Fehlermeldung (deutsch). */
export function validateStaffContractAttachmentFile(file: File): string | null {
  if (file.size <= 0) return "Leere Datei.";
  if (file.size > RESTAURANT_DOCUMENT_MAX_FILE_BYTES) {
    return "Datei ist zu groß (max. 100 MB).";
  }
  if (!staffContractAttachmentExtension(file.name)) {
    return `Nur ${STAFF_CONTRACT_ATTACHMENT_LABEL} sind erlaubt.`;
  }
  if (!resolveStaffContractAttachmentMime(file)) {
    return "Dateityp passt nicht zur Endung oder ist nicht erlaubt.";
  }
  return null;
}
