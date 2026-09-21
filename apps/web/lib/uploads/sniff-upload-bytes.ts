import { sanitizeSvgBytes } from "@/lib/uploads/sanitize-svg";

export type SniffedUploadKind =
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "pdf"
  | "zip"
  | "ole"
  | "heif"
  | "mp4"
  | "quicktime"
  | "webm"
  | "ogg"
  | "mp3"
  | "ico"
  | "svg"
  | "html"
  | "text"
  | "unknown";

const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "heif",
  "mif1",
  "msf1",
  "mihe",
]);

const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso3",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "dash",
  "msnv",
  "ndsc",
  "ndsh",
  "m4v ",
  "m4a ",
  "m4b ",
  "mp71",
]);

const QUICKTIME_ATOMS = new Set([
  "moov",
  "mdat",
  "wide",
  "free",
  "skip",
  "pnot",
]);

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i]!);
  return out;
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function prefixText(bytes: Uint8Array): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, 512));
  return new TextDecoder("utf-8", { fatal: false })
    .decode(slice)
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
}

/** Magic-Bytes der ersten Kilobytes — unabhängig vom vom Browser gemeldeten MIME. */
export function sniffUploadBytes(bytes: Uint8Array): SniffedUploadKind {
  if (bytes.length === 0) return "unknown";

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return "gif";
  }
  if (
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  if (
    startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  ) {
    return "ole";
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (ascii(bytes, 0, 4) === "OggS") return "ogg";
  if (ascii(bytes, 0, 3) === "ID3") return "mp3";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
    return "mp3";
  }

  if (bytes.length >= 4 && ascii(bytes, 0, 2) === "PK") {
    const mark = bytes[2];
    if (mark === 0x03 || mark === 0x05 || mark === 0x07) return "zip";
  }

  if (bytes.length >= 12) {
    const atom = ascii(bytes, 4, 4);
    if (atom === "ftyp") {
      const brand = ascii(bytes, 8, 4).toLowerCase();
      if (HEIF_BRANDS.has(brand)) return "heif";
      if (brand === "qt  ") return "quicktime";
      if (MP4_BRANDS.has(brand)) return "mp4";
      return "mp4";
    }
    if (QUICKTIME_ATOMS.has(atom)) return "quicktime";
  }

  if (
    startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) &&
    ascii(bytes, 4, 4) !== "ftyp"
  ) {
    return "ico";
  }

  const head = prefixText(bytes);
  if (head.startsWith("%pdf-")) return "pdf";
  const pdfAt = head.indexOf("%pdf-");
  if (pdfAt >= 0 && pdfAt < 32) return "pdf";

  if (
    head.startsWith("<svg") ||
    (head.startsWith("<?xml") && head.includes("<svg"))
  ) {
    return "svg";
  }
  if (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<script") ||
    head.startsWith("<body") ||
    head.startsWith("<?xml")
  ) {
    return "html";
  }

  if (head.startsWith("<")) return "html";

  for (let i = 0; i < Math.min(bytes.length, 4096); i++) {
    if (bytes[i] === 0) return "unknown";
  }
  return "text";
}

const MIME_KINDS: Record<string, readonly SniffedUploadKind[]> = {
  "image/jpeg": ["jpeg"],
  "image/jpg": ["jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/heic": ["heif"],
  "image/heif": ["heif"],
  "image/svg+xml": ["svg"],
  "image/x-icon": ["ico", "png"],
  "image/vnd.microsoft.icon": ["ico", "png"],
  "application/pdf": ["pdf"],
  "application/msword": ["ole"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "zip",
  ],
  "application/vnd.apple.pages": ["zip"],
  "application/x-iwork-pages-sffpages": ["zip"],
  "application/vnd.apple.iwork": ["zip"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "video/mp4": ["mp4", "quicktime"],
  "video/quicktime": ["quicktime", "mp4"],
  "video/webm": ["webm"],
  "audio/webm": ["webm"],
  "audio/ogg": ["ogg"],
  "audio/opus": ["ogg"],
  "audio/mp4": ["mp4", "quicktime"],
  "audio/mpeg": ["mp3"],
  "audio/mp3": ["mp3"],
  "text/csv": ["text"],
  "application/csv": ["text"],
  "text/comma-separated-values": ["text"],
  "text/plain": ["text"],
};

/**
 * Prüft den Inhalt gegen den deklarierten MIME-Typ.
 * SVG wird bereinigt zurückgegeben; sonst die Original-Bytes.
 * `null` = Inhalt passt nicht (z. B. HTML als PDF).
 */
export function prepareDeclaredUploadBytes(
  bytes: Uint8Array,
  mime: string,
): Uint8Array | null {
  const normalized = mime.trim().toLowerCase();
  const allowed = MIME_KINDS[normalized];
  if (!allowed) return null;
  const kind = sniffUploadBytes(bytes);
  if (!allowed.includes(kind)) return null;
  if (kind === "svg" || normalized === "image/svg+xml") {
    return sanitizeSvgBytes(bytes);
  }
  return bytes;
}
